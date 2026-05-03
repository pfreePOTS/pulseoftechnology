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
    assert topic.domain == "Security"
    assert topic.subdomain == "Software Supply Chain"
    assert topic.name == "Package Registry Credential Theft"
    assert feedback.action == "approve"
    assert feedback.original_topic_name == "Other: Review Needed"
    assert feedback.corrected_domain == "Security"


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
