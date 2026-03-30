import json
import logging
from typing import Any

import anthropic
from sqlalchemy.orm import Session

from ..config import settings
from ..models.article import Article, ArticleStatus
from ..models.topic import Topic

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None

HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

_EVALUATE_SYSTEM = """\
You are a content classifier for a C-level executive intelligence briefing.
Given an article and a list of existing trending topics, determine:
1. Whether it is relevant to C-level executives (CEOs, CTOs, CISOs, CFOs).
2. The primary domain: one of AI, Security, Cloud, Finance, Leadership, or Other.
3. An urgency score from 1 (low) to 10 (high) reflecting how time-sensitive the topic is.
4. A broad trending topic name (2-4 words) that this article belongs to.
   You MUST prioritize assigning the article to one of the Existing trending topics provided, \
even if the match is only partial or approximate. \
Only suggest a NEW topic name if the article represents a completely novel trend not covered by any existing topic.
5. A plain-language "what is it" sentence (1–2 sentences) explaining the technology or development.
6. A "why it matters" sentence (1–2 sentences) explaining the business impact for executives.
7. A list of 2–4 short tags relevant to this article (e.g. ["AI", "regulation", "compliance"]).

Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "relevant": true | false,
  "domain": "<string>",
  "urgency_score": <integer 1-10>,
  "suggested_topic_name": "<2-4 word broad trend — prefer existing topics>",
  "reason": "<one sentence>",
  "what_is_it": "<1-2 sentence plain-language explanation>",
  "why_it_matters": "<1-2 sentence business impact for executives>",
  "tags": ["<tag1>", "<tag2>"]
}
If the article is not relevant, still return valid JSON with relevant=false, urgency_score=1, and empty strings for what_is_it/why_it_matters."""

_INDUSTRY_POSITIONING_SYSTEM = """\
You are a technology advisor evaluating how a technology topic affects different industries.
Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "industry_suggestions": {
    "<industry_name>": {
      "score": <float 1.0-10.0>,
      "adoption_state": "<one of the 5 states below>",
      "rationale": "<one sentence explaining the urgency and impact for that industry>"
    }
  }
}
Evaluate exactly these 6 industries: Technology, Finance & Banking, Healthcare, \
Manufacturing, Government & Public Sector, Retail & E-Commerce.
The adoption_state must be exactly one of these 5 values:
- "Learn About" — early awareness, little action needed yet
- "Get Ahead Of" — proactive positioning before the trend hits
- "Get Prepared For" — immediate planning required
- "Get Your Hands Around" — active implementation underway
- "Make the Most Of" — fully embraced, optimise for advantage"""

_SUMMARIZE_SYSTEM = """\
You are a trusted C-level technology advisor writing for a weekly executive briefing.
Your writing is concise, authoritative, and free of jargon.
Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "summary": "<2–4 sentence executive summary>",
  "why_it_matters": "<1–3 sentence explanation of business impact>"
}"""


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that Claude sometimes wraps JSON in."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]          # drop the opening ```json line
        text = text.rsplit("```", 1)[0].strip()  # drop the closing ```
    return text


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def evaluate_article(
    article_content: str,
    existing_topics: list[str] | None = None,
) -> dict[str, Any] | None:
    """
    Use Claude Haiku to score and classify a single article.

    Returns a dict with keys: relevant, domain, urgency_score, suggested_topic_name, reason.
    Returns None if the article is not relevant or on parse error.
    """
    if existing_topics:
        topic_list = "\n".join(f"- {t}" for t in existing_topics[:80])
        message = (
            f"Existing trending topics (use one exactly if it fits):\n{topic_list}"
            f"\n\nArticle:\n{article_content}"
        )
    else:
        message = article_content

    client = _get_client()
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=512,
        system=_EVALUATE_SYSTEM,
        messages=[{"role": "user", "content": message}],
    )
    raw = _strip_fences(response.content[0].text)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse evaluate_article response: %r", raw)
        return None

    if not result.get("relevant"):
        return None
    return result


def process_raw_articles(db: Session) -> int:
    """
    Batch-evaluate all raw articles, update their status, and group them into Topics.

    Each article is classified into a specific trending topic name (e.g. "EU AI Act
    Enforcement") rather than a broad domain bucket. Existing topic names are passed
    to the AI so it can cluster related articles together.

    Returns the number of articles processed successfully.
    """
    raw_articles = (
        db.query(Article).filter(Article.status == ArticleStatus.raw).all()
    )
    logger.info("Processing %d raw articles", len(raw_articles))

    # Build a prioritised topic list: approved first, then pending sorted by article count desc.
    # The AI sees the biggest clusters first so it preferentially assigns to them.
    from ..models.topic import TopicStatus as _TS
    from sqlalchemy import func as _func
    approved_names: list[str] = [
        row[0] for row in db.query(Topic.name).filter(Topic.status == _TS.approved).all()
    ]
    pending_names: list[str] = [
        row[0] for row in (
            db.query(Topic.name)
            .outerjoin(Topic.articles)
            .filter(Topic.status == _TS.pending)
            .group_by(Topic.id)
            .order_by(_func.count().desc())
            .limit(50)
        ).all()
    ]
    existing_topic_names: list[str] = approved_names + [n for n in pending_names if n not in approved_names]

    processed_count = 0
    for article in raw_articles:
        content = f"Title: {article.title}\n\n{article.content or ''}"
        try:
            result = evaluate_article(content, existing_topics=existing_topic_names)
        except anthropic.APIError:
            logger.exception("API error evaluating article id=%d", article.id)
            continue

        if result is None:
            article.status = ArticleStatus.processed
            db.commit()
            continue

        domain = result["domain"]
        urgency = float(result["urgency_score"])
        topic_name = (result.get("suggested_topic_name") or domain).strip()

        # Find or create a Topic by its specific name.
        # Try exact match first, then ILIKE fuzzy match as fallback.
        topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if topic is None:
            topic = (
                db.query(Topic)
                .filter(Topic.name.ilike(f"%{topic_name}%"))
                .first()
            )
        if topic is None:
            topic = Topic(name=topic_name, domain=domain, urgency_score=urgency)
            db.add(topic)
            db.flush()
            existing_topic_names.append(topic_name)
        else:
            # Raise topic urgency to the highest article score seen
            if urgency > topic.urgency_score:
                topic.urgency_score = urgency

        article.topic_id = topic.id
        article.status = ArticleStatus.processed
        article.what_is_it = result.get("what_is_it") or None
        article.why_it_matters = result.get("why_it_matters") or None
        article.tags = result.get("tags") or None
        db.commit()
        processed_count += 1
        logger.debug(
            "Article id=%d → topic=%r domain=%r urgency=%s",
            article.id, topic_name, domain, urgency,
        )

    logger.info("Processed %d articles", processed_count)
    return processed_count


def suggest_industry_positions(topic_id: int, db: Session) -> dict[str, Any]:
    """
    Use Claude Haiku to suggest urgency scores, adoption states, and rationales
    for 6 target industries.

    Returns a dict with key "industry_suggestions" mapping industry name →
    {"score": float, "adoption_state": str, "rationale": str}.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise ValueError(f"Topic {topic_id} not found")

    articles = (
        db.query(Article)
        .filter(Article.topic_id == topic_id)
        .limit(8)
        .all()
    )

    article_blurbs = "\n\n".join(
        f"Article {i + 1}: {a.title}\n{a.content or '(no content)'}"
        for i, a in enumerate(articles)
    )
    user_message = (
        f"Topic: {topic.name}\n"
        f"Domain: {topic.domain}\n"
        f"Summary: {topic.summary or '(no summary yet)'}\n\n"
        f"Source articles:\n{article_blurbs or '(no articles linked)'}"
    )

    client = _get_client()
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=1024,
        system=_INDUSTRY_POSITIONING_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )
    raw = _strip_fences(response.content[0].text)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse suggest_industry_positions response: %r", raw)
        raise ValueError("AI returned invalid JSON")


def generate_topic_summary(topic: Topic, articles: list[Article]) -> str:
    """
    Use Claude Sonnet to generate an executive summary for a Topic.

    Saves the generated text to topic.summary and returns it.
    """
    if not articles:
        return ""

    article_blurbs = "\n\n".join(
        f"Article {i + 1}: {a.title}\n{a.content or '(no content)'}"
        for i, a in enumerate(articles[:10])  # cap at 10 to stay within token limits
    )
    user_message = (
        f"Topic: {topic.name}\nDomain: {topic.domain}\n\n"
        f"Articles:\n{article_blurbs}"
    )

    client = _get_client()
    response = client.messages.create(
        model=SONNET_MODEL,
        max_tokens=1024,
        system=_SUMMARIZE_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )
    raw = _strip_fences(response.content[0].text)
    try:
        result = json.loads(raw)
        summary_text = (
            f"{result['summary']}\n\nWhy it matters: {result['why_it_matters']}"
        )
    except (json.JSONDecodeError, KeyError):
        logger.warning("Failed to parse generate_topic_summary response: %r", raw)
        summary_text = raw

    topic.summary = summary_text
    return summary_text


_SIGNAL_SYSTEM = """\
You are a technology trend analyst assessing whether a topic's urgency has changed \
based on a recent surge in press coverage.
Given the topic's current adoption state and a list of recent article summaries, \
determine if the adoption state should be upgraded.

The adoption_state must be exactly one of these 5 values (in escalating order):
- "Learn About" — early awareness, little action needed yet
- "Get Ahead Of" — proactive positioning before the trend hits
- "Get Prepared For" — immediate planning required
- "Get Your Hands Around" — active implementation underway
- "Make the Most Of" — fully embraced, optimise for advantage

Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "recommend_change": true | false,
  "suggested_state": "<one of the 5 adoption states above>",
  "rationale": "<2-3 sentence explanation of why the state should change, or why no change is needed>"
}"""


def evaluate_signal(topic: "Topic", recent_articles: list["Article"]) -> dict[str, Any]:
    """
    Use Claude Haiku to assess whether a topic's adoption state should be upgraded
    based on a recent surge in article velocity.

    Returns dict with keys: recommend_change (bool), suggested_state (str), rationale (str).
    """
    article_blurbs = "\n\n".join(
        f"- {a.title}: {a.what_is_it or a.content or '(no summary)'}"
        for a in recent_articles[:10]
    )
    user_message = (
        f"Topic: {topic.name}\n"
        f"Domain: {topic.domain}\n"
        f"Current adoption state: {topic.adoption_state}\n"
        f"Current urgency score: {topic.urgency_score}/10\n\n"
        f"Recent articles ({len(recent_articles)} in last 7 days):\n{article_blurbs}"
    )

    client = _get_client()
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=512,
        system=_SIGNAL_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )
    raw = _strip_fences(response.content[0].text)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse evaluate_signal response: %r", raw)
        return {"recommend_change": False, "suggested_state": topic.adoption_state, "rationale": "Parse error"}
