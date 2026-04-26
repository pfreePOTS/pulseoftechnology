"""
Prompt optimizer — analyzes AgentRun telemetry and proposes improved system prompts.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.agent_run import AgentRun
from ..models.prompt import PromptProposal, PromptTemplate
from .ai_service import (
    _FALLBACK_PROMPTS,
    SONNET_MODEL,
    _get_client,
    _strip_fences,
    default_model_for_agent,
)

logger = logging.getLogger(__name__)

# _parse() node_name → prompt_templates.agent_name
_PARSE_NODE_TO_AGENT: dict[str, str] = {
    "gate": "gate",
    "classify": "classify",
    "score": "score",
    "cluster": "cluster",
    "summarize": "summarize_node_legacy",
    "topic_persona": "topic_level_persona",
    "subdomain_topic": "subdomain_topic",
    "industry_positions": "industry_positioning",
    "trend_pick": "trend_pick",
    "topic_summary": "summarize_topic",
    "signal": "signal",
}


def agent_name_for_parse_node(node_name: str) -> str:
    return _PARSE_NODE_TO_AGENT.get(node_name, node_name)


def record_agent_run(
    *,
    agent_name: str,
    is_success: bool,
    fallback_used: bool,
    context_text: str | None = None,
    article_id: int | None = None,
    latency_ms: int | None = None,
    tokens: int | None = None,
    model: str | None = None,
) -> None:
    """
    Persist a run row using a fresh Session (safe from worker threads / no caller db).
    """
    db = SessionLocal()
    try:
        db.add(
            AgentRun(
                agent_name=agent_name,
                is_success=is_success,
                fallback_used=fallback_used,
                context_text=context_text,
                article_id=article_id,
                latency_ms=latency_ms,
                tokens=tokens,
                model=model,
            )
        )
        db.commit()
    except Exception:
        logger.exception("record_agent_run failed for agent_name=%r", agent_name)
        db.rollback()
    finally:
        db.close()


def analyze_agent_performance(db: Session, days: int = 7) -> str | None:
    """
    Return the agent_name (prompt_templates key) with the highest count of problematic runs
    (is_success is false OR fallback_used is true) in the last ``days`` days.
    """
    if days < 1:
        days = 1
    cutoff = datetime.now(UTC) - timedelta(days=days)
    row = (
        db.query(AgentRun.agent_name, func.count(AgentRun.id).label("n"))
        .filter(AgentRun.created_at >= cutoff)
        .filter(or_(AgentRun.is_success.is_(False), AgentRun.fallback_used.is_(True)))
        .group_by(AgentRun.agent_name)
        .order_by(func.count(AgentRun.id).desc())
        .first()
    )
    if row is None:
        return None
    return str(row[0])


def _active_template_row(db: Session, agent_name: str) -> PromptTemplate | None:
    return (
        db.query(PromptTemplate)
        .filter(PromptTemplate.agent_name == agent_name, PromptTemplate.is_active.is_(True))
        .order_by(PromptTemplate.id.desc())
        .first()
    )


def generate_prompt_improvement(db: Session, agent_name: str) -> PromptProposal | None:
    """
    Ask Sonnet to rewrite the active system prompt using up to 20 recent failed runs as context.
    Stores a pending PromptProposal.
    """
    if not settings.anthropic_api_key:
        logger.warning("generate_prompt_improvement: ANTHROPIC_API_KEY not set")
        return None

    tpl = _active_template_row(db, agent_name)
    if tpl is not None:
        current_prompt = tpl.system_prompt
        base_version = tpl.version
        runtime_model = tpl.model or default_model_for_agent(agent_name)
    else:
        fb = _FALLBACK_PROMPTS.get(agent_name)
        if fb is None:
            logger.warning("No active template or fallback for agent_name=%r", agent_name)
            return None
        current_prompt = fb
        base_version = "fallback"
        runtime_model = default_model_for_agent(agent_name)

    failed = (
        db.query(AgentRun)
        .filter(AgentRun.agent_name == agent_name)
        .filter(or_(AgentRun.is_success.is_(False), AgentRun.fallback_used.is_(True)))
        .order_by(AgentRun.created_at.desc())
        .limit(20)
        .all()
    )
    if not failed:
        logger.info("generate_prompt_improvement: no failed runs for %r — skipping", agent_name)
        return None

    examples_blocks: list[str] = []
    for i, run in enumerate(failed, 1):
        snippet = (run.context_text or "").strip() or "(no context captured)"
        examples_blocks.append(f"--- Example {i} ---\n{snippet[:8000]}")

    examples_text = "\n\n".join(examples_blocks)

    user_message = f"""You are an expert AI prompt engineer. The following system prompt is failing on these edge cases. Rewrite the system prompt to be more robust, strictly enforcing JSON output and handling these specific inputs. Return ONLY the new prompt text.

## Current system prompt

{current_prompt}

## Failure samples (model output or context, up to 20)

{examples_text}
"""

    response = _get_client().messages.create(
        model=SONNET_MODEL,
        max_tokens=8192,
        system=(
            "You are an expert AI prompt engineer. "
            "Follow the user instructions exactly. Output only the new system prompt text, no preamble."
        ),
        messages=[{"role": "user", "content": user_message}],
    )
    proposed = _strip_fences(response.content[0].text).strip()
    if not proposed:
        logger.warning("generate_prompt_improvement: empty model response")
        return None

    proposal = PromptProposal(
        agent_name=agent_name,
        base_version=base_version,
        model=runtime_model,
        proposed_system_prompt=proposed,
        rationale="",
        test_improvement_score=None,
        status="pending",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    logger.info(
        "Created PromptProposal id=%s for agent_name=%r base_version=%r",
        proposal.id,
        agent_name,
        base_version,
    )
    return proposal


def run_daily_prompt_optimizer_job() -> None:
    """
    Scheduled entrypoint: skip if any proposal is pending; else analyze and maybe generate one.
    """
    db = SessionLocal()
    try:
        pending_n = db.query(PromptProposal).filter(PromptProposal.status == "pending").count()
        if pending_n > 0:
            logger.info("Prompt optimizer: skipping — %d pending proposal(s)", pending_n)
            return

        agent = analyze_agent_performance(db, days=7)
        if agent is None:
            logger.info("Prompt optimizer: no agent with failure telemetry in window")
            return

        generate_prompt_improvement(db, agent)
    except Exception:
        logger.exception("run_daily_prompt_optimizer_job failed")
        db.rollback()
    finally:
        db.close()
