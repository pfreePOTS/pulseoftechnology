from datetime import UTC, datetime

from ..config import settings
from ..models.article import Article, ArticleStatus
from ..models.classification_feedback import ClassificationFeedback
from ..models.source import Source, SourceType
from ..models.topic import Topic


def _login(client) -> None:
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )


def test_review_endpoint_approves_article_and_records_feedback(client, db_session):
    source = Source(name="Bleeping Computer", url="https://example.com/rss", type=SourceType.rss)
    article = Article(
        source=source,
        title="Official SAP npm packages compromised to steal credentials",
        url="https://example.com/npm-credentials",
        content="Attackers compromised npm packages to steal credentials from enterprise systems.",
        status=ArticleStatus.review,
        review_reason="Other: Review Needed fallback",
        ai_output={
            "domain": "Other",
            "subdomain": "",
            "suggested_topic_name": "Other: Review Needed",
        },
        ingested_at=datetime.now(UTC),
    )
    db_session.add_all([source, article])
    db_session.commit()
    _login(client)

    response = client.patch(
        f"/api/admin/articles/{article.id}/review",
        json={
            "action": "approve",
            "domain": "Security",
            "subdomain": "Software Supply Chain",
            "topic_name": "Package Registry Credential Theft",
            "notes": "Security supply-chain story.",
        },
    )

    assert response.status_code == 200
    db_session.refresh(article)
    topic = db_session.query(Topic).one()
    feedback = db_session.query(ClassificationFeedback).one()
    assert article.status == ArticleStatus.processed
    assert article.topic_id == topic.id
    assert article.subdomain == "Software Supply Chain"
    assert topic.domain.short_label == "Security"
    assert topic.subdomain == "Software Supply Chain"
    assert topic.name == "Package Registry Credential Theft"
    assert feedback.action == "approve"
    # AI domain must be kept even when the article has no topic yet (ternary vs `or` precedence).
    assert feedback.original_domain == "Other"
    assert feedback.original_topic_name == "Other: Review Needed"
    assert feedback.corrected_domain == "security"


def test_review_endpoint_skips_non_tech_article_and_records_feedback(client, db_session):
    source = Source(name="Forbes", url="https://example.com/rss", type=SourceType.rss)
    article = Article(
        source=source,
        title="Today’s Wordle hints and answer",
        url="https://example.com/wordle",
        content="Puzzle hints and answer.",
        status=ArticleStatus.review,
        review_reason="No clear Pulse technology signal",
    )
    db_session.add_all([source, article])
    db_session.commit()
    _login(client)

    response = client.patch(
        f"/api/admin/articles/{article.id}/review",
        json={"action": "skip", "notes": "Puzzle content, not technology."},
    )

    assert response.status_code == 200
    db_session.refresh(article)
    feedback = db_session.query(ClassificationFeedback).one()
    assert article.status == ArticleStatus.skipped
    assert article.topic_id is None
    assert article.review_notes == "Puzzle content, not technology."
    assert feedback.action == "skip"


def test_review_retry_resets_attempt_counter(client, db_session):
    source = Source(name="Forbes", url="https://example.com/rss", type=SourceType.rss)
    article = Article(
        source=source,
        title="Why AI Agents Need More Than A Contact Database To Act",
        url="https://example.com/agents-crm",
        content="Enterprise AI agents.",
        status=ArticleStatus.review,
        review_attempts=3,
        review_reason="LLMAPIError (attempt 3): DeepSeek failed; Anthropic fallback failed",
    )
    db_session.add_all([source, article])
    db_session.commit()
    _login(client)

    response = client.patch(
        f"/api/admin/articles/{article.id}/review",
        json={"action": "retry"},
    )

    assert response.status_code == 200
    db_session.refresh(article)
    assert article.status == ArticleStatus.retry
    assert article.review_attempts == 0


def test_requeue_ids_moves_skipped_to_retry(client, db_session):
    source = Source(name="Wire", url="https://example.com/rss", type=SourceType.rss)
    skipped = Article(
        source=source,
        title="Skipped tech story",
        url="https://example.com/skipped",
        content="Body.",
        status=ArticleStatus.skipped,
        review_attempts=1,
    )
    processed = Article(
        source=source,
        title="Already processed",
        url="https://example.com/processed",
        content="Body.",
        status=ArticleStatus.processed,
    )
    db_session.add_all([source, skipped, processed])
    db_session.commit()
    _login(client)

    response = client.post(
        "/api/admin/articles/requeue",
        json={"ids": [skipped.id, processed.id]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requeued"] == 1
    assert processed.id in body["ignored_ids"]
    db_session.refresh(skipped)
    db_session.refresh(processed)
    assert skipped.status == ArticleStatus.retry
    assert skipped.review_attempts == 0
    assert processed.status == ArticleStatus.processed


def test_bulk_requeue_provider_errors_leaves_genuine_review_rows(client, db_session):
    source = Source(name="Wire", url="https://example.com/rss", type=SourceType.rss)
    billing = Article(
        source=source,
        title="Billing failure leftover",
        url="https://example.com/billing",
        content="Body.",
        status=ArticleStatus.review,
        review_attempts=3,
        review_reason=(
            "LLMAPIError (attempt 3): DeepSeek failed; Anthropic fallback failed: "
            "credit balance is too low"
        ),
    )
    uncertain = Article(
        source=source,
        title="Real review needed",
        url="https://example.com/uncertain",
        content="Body.",
        status=ArticleStatus.review,
        review_attempts=2,
        review_reason="Other: Review Needed fallback",
    )
    db_session.add_all([source, billing, uncertain])
    db_session.commit()
    _login(client)

    response = client.post("/api/admin/articles/review/requeue-provider-errors")

    assert response.status_code == 200
    body = response.json()
    assert body["requeued"] == 1
    assert body["left_in_review"] == 1
    db_session.refresh(billing)
    db_session.refresh(uncertain)
    assert billing.status == ArticleStatus.retry
    assert billing.review_attempts == 0
    assert uncertain.status == ArticleStatus.review
    assert uncertain.review_attempts == 2
