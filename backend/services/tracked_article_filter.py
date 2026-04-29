"""Deterministic Pulse mandate for surfaced topic-domain drift on tracked stories.

Some radar domains (Finance, Leadership) ingest adjacent non-technology content when clustering
misbinds. "Stories we're tracking" keeps Finance rows that show FS–tech / cyber / AI surfaces, and
Leadership rows where leadership is tied to enterprise technology, transformation, tooling, or tech
EXEC roles—not pure HR/strategy/general management stories without a tech cue."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models.article import Article

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Keyword banks (substring scan on lowercased text)
# -----------------------------------------------------------------------------

_ENTERPRISE_AND_CYBER_CORE = [
    # Core stack & delivery
    "saas",
    "software",
    "platform",
    "cloud",
    "api",
    "apis",
    "erp",
    "integration",
    "workflow",
    "kubernetes",
    "k8s",
    "datalake",
    "snowflake",
    "salesforce",
    "oracle",
    "sap",
    "cybersecurity",
    "ransomware",
    " malware",
    "breach",
    "phishing",
    "encryption",
    "ddos",
    "outage",
    "downtime",
    "vulnerability",
    "cve",
    "zero trust",
    "sso",
    "mfa",
    "iam ",
    " siem ",
    "soar",
]

_AI_SURFACE = [
    # AI / automation
    "machine learning",
    "artificial intelligence",
    "generative ai",
    "large language model",
    " llm",
]

_FINANCE_RAILS_AND_META_PRODUCT = [
    # Digital finance rails
    "fintech",
    "regtech",
    "cryptocurrency",
    "cryptocurrencies",
    "stablecoin",
    "blockchain",
    "bitcoin",
    "ethereum",
    "digital wallet",
    "mobile banking",
    "payment rail",
    "fednow",
    " usdc ",
    # Meta + money-movement (handled also by `_meta_fintech_context`)
    "stablecoin payouts",
    "meta rolls out stablecoin",
    "blockchain payouts",
]

_FINANCE_CONTEXT_RE = re.compile(
    r"(?i)\b("
    r"bank|banking|payments?|payment rail|treasury|lending|credit|insurance|fintech|regtech|"
    r"trading|portfolio|market data|risk system|fraud|accounting|erp|"
    r"venture|vc|startup|startups|funding|valuation|valuations|ipo|m&a|merger|acquisition|"
    r"investor|capital|stablecoin|crypto|cryptocurrency|blockchain|wallet|usdc"
    r")\b"
)

# Leadership: org-change / culture / strategy only counts when surfaced text ties to digitally
# enabled work — transformation, tooling, VP Eng / CIO-class roles, collaborative platforms,
# intelligent automation, governance of AI/digital systems—not retailer DEI or generic layoffs.
_LEADERSHIP_ORG_AND_WORK_TECH = [
    "digital transformation",
    "digital strategy",
    "technology strategy",
    "tech strategy",
    "digital workplace",
    "workplace technology",
    "remote collaboration",
    "hybrid workplace",
    "employee experience platform",
    "productivity platform",
    "collaboration platform",
    "unified communications",
    "microsoft 365",
    "microsoft teams",
    "google workspace",
    "workday",
    "servicenow",
    "successfactors",
    "hr tech",
    "hr technology",
    "hris",
    "people analytics",
    "talent management system",
    "learning management",
    " lms ",
    "learning experience platform",
    "lxp",
    "digital upskilling",
    "digital skills",
    "tech skills",
    "technology skills",
    "algorithmic management",
    "ai governance",
    "responsible ai",
    "data-driven leadership",
    "data driven leadership",
    "analytics platform",
    "business intelligence",
    " bi tool",
    " bi tools",
    "digital culture",
    "technology culture",
    "it culture",
    "digital change",
    "technology change",
    "process automation",
    "workflow automation",
    "intelligent automation",
    "robotic process",
    " rpa ",
    "low-code",
    "low code",
    "no-code",
    "no code",
    "engineering organization",
    "engineering org",
    "product engineering",
    "tech organization",
    "technology organization",
    "vp of engineering",
    "vice president of engineering",
    "chief information officer",
    "chief technology officer",
    "chief digital officer",
    "technology leadership",
    "tech leadership",
    "it leadership",
    "information technology",
    "information-technology",
]

TECH_NEEDLES_LEADERSHIP = _ENTERPRISE_AND_CYBER_CORE + _AI_SURFACE + _LEADERSHIP_ORG_AND_WORK_TECH

# Max characters of article.body passed into the tracked-stories heuristic (cheap API payloads).
_SURFACE_CONTENT_CHARS = 14_000


def _meta_fintech_context(low: str) -> bool:
    """‘Meta’ the company + money-movement / digital-asset tech (not generic ‘metadata’)."""
    if not re.search(r"(?i)\bmeta\b", low):
        return False
    return bool(
        re.search(
            r"(?i)(stablecoin|blockchain|cryptocurrency|usdc|libra|payment|wallet|payout|digital currency|crypto)",
            low,
        )
    )


def _exec_tech_title_signal(low: str) -> bool:
    """CIO / CTO / CISO as leadership subject when not buried in unrelated prose (short-circuit aid)."""
    return bool(re.search(r"(?i)\b(cio|cto|ciso)\b", low))


def _collaboration_stack_vendor_signal(low: str) -> bool:
    """Slack / Zoom mentions (substring scan hits false positives e.g. ‘slacken’, ‘slack off’ quirks)."""
    return bool(re.search(r"(?i)\b(slack|zoom)\b", low))


def _text_from_fields(title: str, what_is_it: str | None, content_head: str) -> str:
    return "\n".join(s for s in (title or "", what_is_it or "", content_head or "") if (s or "").strip())


def _any_needle(low: str, needles: list[str]) -> bool:
    for needle in needles:
        if needle in low:
            return True
    return False


def tracked_finance_article_has_pulse_tech_signals(
    title: str,
    what_is_it: str | None,
    content_head: str,
) -> bool:
    merged = _text_from_fields(title, what_is_it, content_head)
    if not merged.strip():
        return False
    low = merged.lower()

    if _any_needle(low, _FINANCE_RAILS_AND_META_PRODUCT):
        return True

    has_finance_context = bool(_FINANCE_CONTEXT_RE.search(low))
    has_generic_tech_context = _any_needle(low, _ENTERPRISE_AND_CYBER_CORE + _AI_SURFACE) or bool(
        re.search(r"(?i)\b(ai|automation|digital|tokeni[sz]ation|platforms?)\b", low)
    )
    if has_finance_context and has_generic_tech_context:
        return True

    if _meta_fintech_context(low):
        return True

    return False


def tracked_leadership_article_has_pulse_tech_signals(
    title: str,
    what_is_it: str | None,
    content_head: str,
) -> bool:
    """True when leadership content shows enterprise-technology, digital work, or tech-exec signal."""
    merged = _text_from_fields(title, what_is_it, content_head)
    if not merged.strip():
        return False
    low = merged.lower()

    if _any_needle(low, TECH_NEEDLES_LEADERSHIP):
        return True

    if _collaboration_stack_vendor_signal(low):
        return True

    if _exec_tech_title_signal(low):
        return True

    return False


def article_pulse_evidence_deep_blob(article: Article) -> str:
    """Full ingestion / reclassification context: raw content plus summaries, tags, and subdomain cues."""
    tags = getattr(article, "tags", None) or []
    tag_text = " ".join(str(t) for t in tags if str(t).strip())
    return "\n".join(
        part
        for part in (
            article.content or "",
            article.what_is_it or "",
            article.why_it_matters or "",
            getattr(article, "subdomain", "") or "",
            tag_text,
        )
        if part.strip()
    )


def article_pulse_evidence_surface_content(article: Article) -> str:
    """Truncated article text for lightweight public-tracked checks."""
    if not getattr(article, "content", None) or not str(article.content).strip():
        return ""
    return " ".join(str(article.content).split())[:_SURFACE_CONTENT_CHARS]


def article_passes_pulse_tech_deep(article: Article, domain: str | None) -> bool:
    """
    Applies deterministic Finance / Leadership cues used at ingest and legacy cleanup.

    Uses rich evidence (summaries, tags, subdomain, full-ish content—not truncated like the API).
    Domains outside Finance / Leadership always pass.
    """
    dom = (domain or "").strip()
    if dom not in ("Finance", "Leadership"):
        return True

    title = getattr(article, "title", None) or ""
    what = getattr(article, "what_is_it", None)
    blob = article_pulse_evidence_deep_blob(article)
    if dom == "Finance":
        return tracked_finance_article_has_pulse_tech_signals(title, what, blob)
    return tracked_leadership_article_has_pulse_tech_signals(title, what, blob)


def article_qualifies_pulse_tracked_surface(article: Article) -> bool:
    """Finance and Leadership rows must embed a Pulse tech cue; other domains unchanged.

    Uses truncated body text plus title/teaser — lighter than ingest-time `article_pulse_evidence_deep_blob`.
    """
    topic = getattr(article, "topic", None)
    dom = (topic.domain.strip() if topic and topic.domain else "") or ""
    if dom not in ("Finance", "Leadership"):
        return True

    title = getattr(article, "title", None) or ""
    what = getattr(article, "what_is_it", None)
    blob = article_pulse_evidence_surface_content(article)

    if dom == "Finance":
        ok = tracked_finance_article_has_pulse_tech_signals(title, what, blob)
        if not ok:
            logger.debug(
                "Tracked surface skips Finance article id=%s — no Pulse tech substring in surfaced fields",
                article.id,
            )
        return ok

    ok = tracked_leadership_article_has_pulse_tech_signals(title, what, blob)
    if not ok:
        logger.debug(
            "Tracked surface skips Leadership article id=%s — no Pulse tech substring in surfaced fields",
            article.id,
        )
    return ok
