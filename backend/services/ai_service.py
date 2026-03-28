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

HAIKU_MODEL = "claude-haiku-4-5"
SONNET_MODEL = "claude-sonnet-4-6"

_EVALUATE_SYSTEM = """\
You are a content classifier for a C-level executive intelligence briefing.
Given an article, determine:
1. Whether it is relevant to C-level executives (CEOs, CTOs, CISOs, CFOs).
2. The primary domain: one of AI, Security, Cloud, Finance, Leadership, or Other.
3. An urgency score from 1 (low) to 10 (high) reflecting how time-sensitive the topic is.

Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "relevant": true | false,
  "domain": "<string>",
  "urgency_score": <integer 1-10>,
  "reason": "<one sentence>"
}
If the article is not relevant, still return valid JSON with relevant=false and urgency_score=1."""

_SUMMARIZE_SYSTEM = """\
You are a trusted C-level technology advisor writing for a weekly executive briefing.
Your writing is concise, authoritative, and free of jargon.
Respond with valid JSON only — no markdown, no explanation. Schema:
{
  "summary": "<2–4 sentence executive summary>",
  "why_it_matters": "<1–3 sentence explanation of business impact>"
}"""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def evaluate_article(article_content: str) -> dict[str, Any] | None:
    """
    Use Claude Haiku to score and classify a single article.

    Returns a dict with keys: relevant, domain, urgency_score, reason.
    Returns None if the article is not relevant or on parse error.
    """
    client = _get_client()
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=512,
        system=_EVALUATE_SYSTEM,
        messages=[{"role": "user", "content": article_content}],
    )
    raw = response.content[0].text.strip()
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

    Returns the number of articles processed successfully.
    """
    raw_articles = (
        db.query(Article).filter(Article.status == ArticleStatus.raw).all()
    )
    logger.info("Processing %d raw articles", len(raw_articles))

    processed_count = 0
    for article in raw_articles:
        content = f"Title: {article.title}\n\n{article.content or ''}"
        try:
            result = evaluate_article(content)
        except anthropic.APIError:
            logger.exception("API error evaluating article id=%d", article.id)
            continue

        if result is None:
            article.status = ArticleStatus.processed
            db.commit()
            continue

        domain = result["domain"]
        urgency = float(result["urgency_score"])

        # Find or create a Topic for this domain
        topic = db.query(Topic).filter(Topic.domain == domain).first()
        if topic is None:
            topic = Topic(name=domain, domain=domain, urgency_score=urgency)
            db.add(topic)
            db.flush()
        else:
            # Raise topic urgency to the highest article score
            if urgency > topic.urgency_score:
                topic.urgency_score = urgency

        article.topic_id = topic.id
        article.status = ArticleStatus.processed
        db.commit()
        processed_count += 1
        logger.debug("Article id=%d → domain=%r urgency=%s", article.id, domain, urgency)

    logger.info("Processed %d articles", processed_count)
    return processed_count


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
    raw = response.content[0].text.strip()
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
