"""Unit tests for backend/services/email_service.py."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ..models.content import ContentItem
from ..models.newsletter_issue import NewsletterIssue
from ..models.site_config import SiteConfig
from ..models.subscriber import Subscriber
from ..models.topic import Topic
from ..services import email_service


def _mock_db_for_daily_newsletter(
    topic_rows: list,
    subscriber_rows: list,
) -> MagicMock:
    """Distinct query chains per model (MagicMock.query overwrites break Topic vs Subscriber)."""
    mock_db = MagicMock()

    def query_side_effect(model):
        if model is Topic:
            q = MagicMock()
            q.filter.return_value.all.return_value = topic_rows
            return q
        if model is Subscriber:
            q = MagicMock()
            q.filter.return_value.all.return_value = subscriber_rows
            return q
        if model is SiteConfig:
            q = MagicMock()
            q.filter.return_value.first.return_value = None
            return q
        if model is ContentItem:
            q = MagicMock()
            q.filter.return_value.order_by.return_value.all.return_value = []
            return q
        return MagicMock()

    mock_db.query.side_effect = query_side_effect
    return mock_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sub(**kw) -> SimpleNamespace:
    defaults = dict(
        id=1,
        email="jane@example.com",
        first_name="Jane",
        last_name="Smith",
        industries=["Technology"],
        domains=["AI", "Security"],
        is_active=True,
    )
    return SimpleNamespace(**{**defaults, **kw})


def _topic(domain: str = "AI", urgency: float = 8.0, name: str = "GPT-5 Launch") -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        name=name,
        domain=domain,
        urgency_score=urgency,
        summary=f"{name}: a major development.",
    )


# ---------------------------------------------------------------------------
# send_daily_newsletter
# ---------------------------------------------------------------------------


class TestSendDailyNewsletter:
    def _mock_response(self, status_code: int = 202) -> MagicMock:
        resp = MagicMock()
        resp.status_code = status_code
        return resp

    def test_returns_true_on_202(self):
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            result = email_service.send_daily_newsletter(_sub(), [_topic()])

        assert result == (True, None)
        mock_sg.send.assert_called_once()

    def test_returns_false_on_non_202(self):
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(400)

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            result = email_service.send_daily_newsletter(_sub(), [_topic()])

        assert result == (False, "SendGrid returned HTTP 400 (expected 202).")

    def test_returns_false_on_exception(self):
        mock_sg = MagicMock()
        mock_sg.send.side_effect = Exception("Network error")

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            result = email_service.send_daily_newsletter(_sub(), [_topic()])

        assert result == (False, "Network error")

    def test_email_sent_to_correct_address(self):
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)
        sub = _sub(email="ceo@corp.com")

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            email_service.send_daily_newsletter(sub, [_topic()])

        call_args = mock_sg.send.call_args
        mail_obj = call_args.args[0]
        # The Mail object stores recipients; check the serialised dict
        mail_dict = mail_obj.get()
        assert "ceo@corp.com" in str(mail_dict)

    def test_subject_includes_topic_count(self, monkeypatch):
        monkeypatch.setattr(email_service.settings, "sendgrid_newsletter_template_id", "")
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)
        topics = [_topic("AI", 9.0, "Topic A"), _topic("Security", 7.0, "Topic B")]

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            email_service.send_daily_newsletter(_sub(), topics)

        mail_obj = mock_sg.send.call_args.args[0]
        mail_dict = mail_obj.get()
        assert "Pulse of Technology Daily" in str(mail_dict)
        assert "2 signals" in str(mail_dict)

    def test_ignores_sendgrid_template_id_uses_full_html(self, monkeypatch):
        """SENDGRID_NEWSLETTER_TEMPLATE_ID must not switch to dynamic template — full HTML only."""
        monkeypatch.setattr(email_service.settings, "sendgrid_newsletter_template_id", "d-abc123")
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            email_service.send_daily_newsletter(_sub(), [_topic()])

        mail_obj = mock_sg.send.call_args.args[0]
        mail_dict = mail_obj.get()
        assert mail_obj.template_id is None
        assert any(c.get("type") == "text/html" for c in mail_dict.get("content") or [])


# ---------------------------------------------------------------------------
# assemble_newsletter_topics
# ---------------------------------------------------------------------------


class TestAssembleNewsletterTopics:
    def test_filters_by_subscriber_domains(self):
        sub = _sub(domains=["AI", "Cloud"])
        topics = [
            _topic("AI", 9.0, "A"),
            _topic("Security", 8.5, "B"),
            _topic("Cloud", 7.0, "C"),
        ]
        result = email_service.assemble_newsletter_topics(sub, topics)
        names = [t.name for t in result]
        assert "A" in names
        assert "C" in names
        assert "B" not in names

    def test_explicit_domains_match_topic_domain_case_insensitively(self):
        sub = _sub(domains=["ai", "cloud"])
        topics = [
            _topic("AI", 9.0, "A"),
            _topic("Security", 8.5, "B"),
            _topic("Cloud", 7.0, "C"),
        ]
        result = email_service.assemble_newsletter_topics(sub, topics)
        names = {t.name for t in result}
        assert names == {"A", "C"}

    def test_returns_all_when_no_domain_preference(self):
        sub = _sub(domains=None)
        topics = [_topic("AI"), _topic("Security"), _topic("Finance")]
        result = email_service.assemble_newsletter_topics(sub, topics)
        assert len(result) == 3

    def test_role_tags_do_not_filter_content_when_domains_empty(self):
        """Titles/roles personalize context, not topic selection."""
        role = SimpleNamespace(tags=["Security", "Cloud"])
        sub = _sub(domains=None, roles=[role])
        topics = [
            _topic("AI", 9.0, "A"),
            _topic("Security", 8.0, "B"),
            _topic("Cloud", 7.0, "C"),
            _topic("Finance", 6.0, "D"),
        ]
        result = email_service.assemble_newsletter_topics(sub, topics)
        names = {t.name for t in result}
        assert names == {"A", "B", "C", "D"}

    def test_subscriber_domains_override_role_tags(self):
        """Explicit wizard domains win over role tags."""
        role = SimpleNamespace(tags=["Security", "Cloud"])
        sub = _sub(domains=["AI"], roles=[role])
        topics = [
            _topic("AI", 9.0, "A"),
            _topic("Security", 8.0, "B"),
        ]
        result = email_service.assemble_newsletter_topics(sub, topics)
        assert [t.name for t in result] == ["A"]

    def test_role_tags_do_not_narrow_single_topic_pool(self):
        role = SimpleNamespace(tags=["security"])
        sub = _sub(domains=None, roles=[role])
        topics = [_topic("AI", 9.0, "A"), _topic("Security", 8.0, "S")]
        result = email_service.assemble_newsletter_topics(sub, topics)
        assert [t.name for t in result] == ["A", "S"]

    def test_returns_empty_when_no_match(self):
        sub = _sub(domains=["Leadership"])
        topics = [_topic("AI"), _topic("Security")]
        result = email_service.assemble_newsletter_topics(sub, topics)
        assert result == []

    def test_sorted_by_urgency_descending(self):
        sub = _sub(domains=None)
        topics = [
            _topic("AI", 5.0, "Low"),
            _topic("Security", 9.0, "High"),
            _topic("Cloud", 7.0, "Mid"),
        ]
        result = email_service.assemble_newsletter_topics(sub, topics)
        scores = [t.urgency_score for t in result]
        assert scores == sorted(scores, reverse=True)

    def test_skip_domain_filter_returns_full_pool(self):
        """Preview mode with no domains still returns the full topic pool."""
        role = SimpleNamespace(tags=["Finance"])
        sub = _sub(domains=None, roles=[role])
        topics = [_topic("AI", 9.0, "A"), _topic("Security", 8.0, "B")]
        narrow = email_service.assemble_newsletter_topics(sub, topics)
        assert len(narrow) == 2
        full = email_service.assemble_newsletter_topics(sub, topics, skip_domain_filter=True)
        assert len(full) == 2

    def test_merged_pipeline_triggers_resolver(self):
        merged = SimpleNamespace(
            newsletter_top_ingest_hours=24,
            newsletter_deep_dive_ingest_hours=72,
            newsletter_article_lookback_days=4,
        )
        sub = _sub()
        topics = [_topic()]
        fake_db = MagicMock()
        with patch.object(
            email_service,
            "_resolve_newsletter_topic_pool",
            return_value=(topics, "domains_only"),
        ) as mock_r:
            out = email_service.assemble_newsletter_topics(
                sub, topics, db=fake_db, merged_pipeline=merged
            )
        assert out == topics
        mock_r.assert_called_once()


def test_assemble_newsletter_topics_excludes_other_domain():
    sub = _sub(domains=None)
    topics = [
        _topic("AI", 9.0, "A"),
        _topic("Other", 9.5, "Oil markets"),
        _topic("Security", 8.0, "S"),
    ]
    out = email_service.assemble_newsletter_topics(sub, topics)
    assert all(t.domain != "Other" for t in out)
    assert {t.name for t in out} == {"A", "S"}


def test_order_newsletter_pool_industry_first_prefers_grid_hits():
    """PULSE-019: high-urgency AI without industry signals sorts after industry hits."""
    ingest = email_service.NewsletterArticleIngestCutoffs(
        top_rank_peak=datetime.now(UTC),
        deep_dive_primary=datetime.now(UTC),
        legacy_fallback=datetime.now(UTC),
    )
    ai_hot = SimpleNamespace(
        id=1,
        name="AI Agents Everywhere",
        urgency_score=99.0,
        industry_positions=None,
        domain="AI",
    )
    insurance = SimpleNamespace(
        id=2,
        name="Insurance cyber ops",
        urgency_score=40.0,
        industry_positions={
            "Insurance": {"industry_impact": "Carriers face claims pressure."},
        },
        domain="Security",
    )
    sub = _sub(industries=["Insurance"], domains=["AI", "Security"])
    ordered = email_service._order_newsletter_pool_industry_first(
        [ai_hot, insurance],
        db=MagicMock(),
        subscriber=sub,
        role_names=None,
        ingest=ingest,
    )
    assert [t.name for t in ordered] == ["Insurance cyber ops", "AI Agents Everywhere"]


def test_finance_banking_alias_matches_financial_services_grid_and_ranks_first():
    """Wizard 'Finance & Banking' must match Analysis grid key 'Financial Services'."""
    ingest = email_service.NewsletterArticleIngestCutoffs(
        top_rank_peak=datetime.now(UTC),
        deep_dive_primary=datetime.now(UTC),
        legacy_fallback=datetime.now(UTC),
    )
    ai_hot = SimpleNamespace(
        id=1,
        name="Generic AI agents",
        urgency_score=99.0,
        industry_positions=None,
        domain="AI",
    )
    fs_security = SimpleNamespace(
        id=2,
        name="Banking ransomware posture",
        urgency_score=40.0,
        industry_positions={
            "Financial Services": {
                "industry_impact": "Core banking outages hit payments and trust.",
            },
        },
        domain="Security",
    )
    assert email_service._topic_has_industry_grid_hit(
        fs_security, ["Finance & Banking"]
    )
    assert not email_service._topic_has_industry_grid_hit(ai_hot, ["Finance & Banking"])

    sub = _sub(industries=["Finance & Banking"], domains=["security"])
    ordered = email_service._order_newsletter_pool_industry_first(
        [ai_hot, fs_security],
        db=MagicMock(),
        subscriber=sub,
        role_names=None,
        ingest=ingest,
    )
    assert [t.name for t in ordered] == ["Banking ransomware posture", "Generic AI agents"]

    teaser = email_service._subscriber_industry_teaser(fs_security, sub)
    assert "Core banking outages" in teaser


def test_assemble_newsletter_topics_with_tier_reports_skip_label():
    sub = _sub(domains=["AI"])
    topics = [_topic("AI"), _topic("Security")]
    out, tier = email_service.assemble_newsletter_topics_with_tier(
        sub, topics, skip_domain_filter=True
    )
    assert tier == "preview_skip_domain_filter"
    assert len(out) == 2


# ---------------------------------------------------------------------------
# run_daily_newsletter integration
# ---------------------------------------------------------------------------


def _assemble_topics_legacy_stub(
    subscriber: object,
    eligible_topics: list,
    db=None,
    **kwargs: object,
) -> list:
    """Scheduler tests use MagicMock DB — article-aware assembly needs a real session."""
    cohort = email_service._domain_topics_for_subscriber(eligible_topics, subscriber)
    return sorted(cohort, key=lambda t: t.urgency_score, reverse=True)


class TestRunDailyNewsletter:
    def test_skips_when_no_recent_topics(self):
        mock_db = _mock_db_for_daily_newsletter(topic_rows=[], subscriber_rows=[])

        with (
            patch.object(email_service.settings, "sendgrid_api_key", "test-key-for-ci"),
            patch.object(email_service, "build_hot_of_day", return_value={"hot_topic": None}),
            patch.object(
                email_service,
                "assemble_newsletter_topics",
                side_effect=_assemble_topics_legacy_stub,
            ),
            patch.object(email_service, "send_daily_newsletter") as mock_send,
            patch.object(email_service, "set_last_newsletter_sent_at"),
        ):
            email_service.run_daily_newsletter(mock_db)

        mock_send.assert_not_called()

    def test_sends_to_matching_subscribers(self):
        sub = _sub(domains=["AI"])
        topic = _topic("AI", 9.0)

        mock_db = _mock_db_for_daily_newsletter(topic_rows=[topic], subscriber_rows=[sub])

        with (
            patch.object(email_service.settings, "sendgrid_api_key", "test-key-for-ci"),
            patch.object(email_service, "build_hot_of_day", return_value={"hot_topic": None}),
            patch.object(
                email_service,
                "assemble_newsletter_topics",
                side_effect=_assemble_topics_legacy_stub,
            ),
            patch.object(
                email_service, "send_daily_newsletter", return_value=(True, None)
            ) as mock_send,
            patch.object(email_service, "set_last_newsletter_sent_at"),
        ):
            email_service.run_daily_newsletter(mock_db)

        assert mock_send.call_count == 1
        call = mock_send.call_args
        assert call[0][0] == sub
        assert call[0][1] == [topic]
        assert call.kwargs["db"] is mock_db
        assert "promoted_content" in call.kwargs
        assert call.kwargs.get("hot_of_day") == {"hot_topic": None}
        assert call.kwargs.get("merged_pipeline") is not None

    def test_skips_subscriber_with_no_matching_domains(self):
        sub = _sub(domains=["Finance"])
        topic = _topic("AI", 9.0)

        mock_db = _mock_db_for_daily_newsletter(topic_rows=[topic], subscriber_rows=[sub])

        with (
            patch.object(email_service.settings, "sendgrid_api_key", "test-key-for-ci"),
            patch.object(email_service, "build_hot_of_day", return_value={"hot_topic": None}),
            patch.object(
                email_service,
                "assemble_newsletter_topics",
                side_effect=_assemble_topics_legacy_stub,
            ),
            patch.object(email_service, "send_daily_newsletter") as mock_send,
            patch.object(email_service, "set_last_newsletter_sent_at"),
        ):
            email_service.run_daily_newsletter(mock_db)

        mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# send_test_newsletter
# ---------------------------------------------------------------------------


def test_send_test_newsletter_rejects_without_sendgrid():
    mock_db = MagicMock()
    with patch.object(email_service.settings, "sendgrid_api_key", ""):
        ok, msg = email_service.send_test_newsletter(mock_db, "a@b.com")
    assert ok is False
    assert "SENDGRID" in msg


def test_send_test_newsletter_rejects_when_no_pipeline_topics():
    mock_db = _mock_db_for_daily_newsletter(topic_rows=[], subscriber_rows=[])
    with patch.object(email_service.settings, "sendgrid_api_key", "k"):
        ok, msg = email_service.send_test_newsletter(mock_db, "a@b.com")
    assert ok is False
    assert "watched" in msg.lower() or "selected" in msg.lower()


def test_send_test_newsletter_dispatches():
    topic = _topic()
    mock_db = _mock_db_for_daily_newsletter(topic_rows=[topic], subscriber_rows=[])
    merged = SimpleNamespace(
        newsletter_top_ingest_hours=24,
        newsletter_deep_dive_ingest_hours=72,
        newsletter_article_lookback_days=7,
        newsletter_enabled=True,
    )
    with (
        patch.object(email_service.settings, "sendgrid_api_key", "k"),
        patch.object(email_service, "merge_pipeline_settings", return_value=merged),
        patch.object(
            email_service, "send_daily_newsletter", return_value=(True, None)
        ) as mock_send,
    ):
        ok, msg = email_service.send_test_newsletter(mock_db, "Curator@Example.com")
    assert ok is True
    assert "curator@example.com" in msg
    mock_send.assert_called_once()
    dummy = mock_send.call_args[0][0]
    assert dummy.email == "curator@example.com"


def test_deep_dive_section_has_structured_briefing_and_trending():
    from ..models.topic import AdoptionState

    topic = SimpleNamespace(
        id=42,
        name="AI Agents",
        domain="AI",
        urgency_score=8.0,
        summary="Legacy block summary should not appear as one blob when briefing is set.",
        newsletter_briefing={
            "what_is_it": "Enterprises are wiring agents into workflows.",
            "what_changed": "New vendor partnerships shifted the pace.",
            "why_it_matters": "Leaders must balance speed and control.",
            "what_to_do": "Pilot on one high-value workflow first.",
        },
        industry_positions=None,
        adoption_state=AdoptionState.learn_about,
    )
    mock_db = MagicMock()
    with patch.object(email_service, "newsletter_topic_velocity_trend", return_value="up"):
        html = email_service._build_deep_dive_section(
            topic,
            [],
            [],
            "Leader",
            subscriber=None,
            db=mock_db,
        )
    assert "What it is (today)" in html
    assert "What has changed" in html
    assert "Trending" in html
    assert "&#8593;" in html
    assert "Enterprises are wiring agents" in html
    assert "<img" not in html
    # No lead article: topic name remains the section headline.
    assert "AI Agents" in html


def test_deep_dive_leads_with_linked_article_title_then_radar_context():
    from ..models.topic import AdoptionState

    topic = SimpleNamespace(
        id=42,
        name="Identity and access",
        domain="Security",
        urgency_score=8.0,
        summary="Topic summary.",
        newsletter_briefing={
            "what_is_it": "Biometric checks are becoming table stakes.",
            "what_changed": "Fraud rings scaled fake remote hires.",
            "why_it_matters": "One fake employee can expose secrets.",
            "what_to_do": "Require liveness checks for privileged hires.",
        },
        industry_positions=None,
        adoption_state=AdoptionState.get_prepared_for,
    )
    lead = SimpleNamespace(
        title="Anthropic Adds AI Watermarks",
        url="https://example.com/anthropic-watermarks",
        what_is_it=None,
        why_it_matters=None,
        persona_by_role=None,
        ingested_at=datetime(2026, 8, 12, 10, 0, tzinfo=UTC),
        published_at=None,
    )
    extra = SimpleNamespace(
        title="Secondary source on identity risk",
        url="https://example.com/secondary",
        what_is_it=None,
        why_it_matters=None,
        persona_by_role=None,
        ingested_at=datetime(2026, 8, 11, 10, 0, tzinfo=UTC),
        published_at=None,
    )
    mock_db = MagicMock()
    with patch.object(email_service, "newsletter_topic_velocity_trend", return_value="flat"):
        html = email_service._build_deep_dive_section(
            topic,
            [lead, extra],
            [],
            "Leader",
            subscriber=None,
            db=mock_db,
        )

    lead_pos = html.find("Anthropic Adds AI Watermarks")
    domain_pos = html.find("SECURITY")
    topic_pos = html.find("Identity and access")
    briefing_pos = html.find("What it is (today)")
    assert lead_pos != -1
    assert domain_pos != -1 and topic_pos != -1 and briefing_pos != -1
    assert lead_pos < domain_pos < briefing_pos
    assert lead_pos < topic_pos < briefing_pos
    assert 'href="https://example.com/anthropic-watermarks"' in html
    assert "YOUR POSTURE:" in html
    assert "Top reads (sources)" in html
    assert "Secondary source on identity risk" in html
    # Lead article is the headline, not duplicated in Top reads.
    assert "Anthropic Adds AI Watermarks" not in html.split("Top reads (sources)")[1]


def test_newsletter_what_to_do_fallback_is_contextual_not_generic():
    from ..models.topic import AdoptionState

    topic = SimpleNamespace(
        id=43,
        name="Identity Attack Automation",
        domain="Security",
        subdomain="Identity",
        urgency_score=8.7,
        summary="Attackers are automating identity abuse.",
        newsletter_briefing={
            "what_is_it": "Identity attacks are accelerating.",
            "what_changed": "Automation is increasing the pace.",
            "why_it_matters": "Account compromise can disrupt operations.",
            "what_to_do": "",
        },
        industry_positions=None,
        adoption_state=AdoptionState.get_prepared_for,
    )

    briefing = email_service._resolve_newsletter_briefing(topic, [], subscriber=None)

    assert briefing["what_to_do"] != (
        "Assign an owner to scan the sources and decide what warrants a pilot or policy update."
    )
    assert (
        "identity" in briefing["what_to_do"].lower() or "security" in briefing["what_to_do"].lower()
    )
    assert len([s for s in briefing["what_to_do"].split(".") if s.strip()]) <= 2


def test_welcome_rollup_keeps_space_before_industry_clause():
    html = email_service._build_welcome_rollup_html(
        now=datetime(2026, 8, 12, 12, 0, tzinfo=UTC),
        industry_line=" for the Technology sector",
        hot_article_title="Lead story",
        top_story_names=["Second story"],
    )
    assert "tracking for the Technology sector" in html
    assert "trackingfor" not in html


def test_newsletter_header_banner_promotes_pulse_of_technology():
    """Brand banner: newsletter name is hero; PulseOne logo is secondary; no lead headline."""
    banner = email_service._build_newsletter_header_banner_html()
    assert "The Pulse of" in banner
    assert "Technology" in banner
    assert "#E91D24" in banner
    assert "Pulse of Technology Daily" not in banner
    # Tagline lives in the logo artwork (and alt text) — do not duplicate it as body copy.
    assert "People | Technology | Progress" in banner
    assert "PEOPLE | TECHNOLOGY | PROGRESS</p>" not in banner
    assert "pots_logo_new.png" in banner
    assert 'width="140"' in banner or 'max-width:140px' in banner
    assert "font-size:34px" in banner
    # Split accent: Technology in brand red (not a single flat black title string only).
    assert 'color:#E91D24' in banner or 'color: #E91D24' in banner
    assert "The Pulse of Technology</p>" not in banner

def test_build_html_header_omits_hot_headline_and_includes_story_rollup():
    hot = {
        "hot_topic": {
            "id": 1,
            "name": "Enterprise AI",
            "domain": "AI",
            "subdomain": "Agents",
        },
        "hot_article": {
            "title": "Microsoft agent story",
            "url": "https://example.com/x",
            "source_name": "TechCrunch",
            "ingested_at": datetime(2026, 4, 13, 12, 13, 7, tzinfo=UTC),
        },
    }
    topics = [
        SimpleNamespace(id=1, name="Enterprise AI", domain="AI", urgency_score=9.0, summary="A."),
        SimpleNamespace(id=2, name="Second story", domain="AI", urgency_score=8.0, summary="B."),
        SimpleNamespace(id=3, name="Cloud spend", domain="Cloud", urgency_score=7.0, summary="C."),
    ]
    sub = _sub()
    html = email_service._build_html(
        sub,
        topics,
        db=MagicMock(),
        hot_of_day=hot,
    )
    pre_greeting, _, post_greeting = html.partition("Good morning")
    assert "Microsoft agent story" not in pre_greeting
    assert "Pulse of Technology" in pre_greeting
    assert "Pulse of Technology Daily" not in pre_greeting
    assert "Microsoft agent story" in post_greeting
    assert "Hot on your radar" in html
    assert "Second story" in html
    assert "pots_logo_new.png" in html
    assert 'href="https://pulseone.com"' in html
    assert "twitter.com/intent/tweet" in html
    assert "mailto:?" in html
    # Welcome rollup names the hot lead and remaining top stories.
    assert "Microsoft agent story" in post_greeting.split("Hot on your radar")[0]
    assert "Second story" in post_greeting.split("Hot on your radar")[0]
    # Logo + hot lead image only; do not add another lead image to the remaining top story.
    assert html.count("<img") == 2


def test_build_html_hot_topic_lead_when_subscriber_includes_hot_topic():
    hot = {
        "hot_topic": {
            "id": 1,
            "name": "Enterprise AI",
            "domain": "AI",
            "subdomain": "Agents",
        },
        "hot_article": {
            "title": "Microsoft agent story",
            "url": "https://example.com/x",
            "source_name": "TechCrunch",
            "ingested_at": datetime(2026, 4, 13, 12, 13, 7, tzinfo=UTC),
        },
    }
    topics = [
        SimpleNamespace(id=1, name="Enterprise AI", domain="AI", urgency_score=9.0, summary="A."),
        SimpleNamespace(id=2, name="Second story", domain="AI", urgency_score=8.0, summary="B."),
    ]
    sub = _sub()
    html = email_service._build_html(
        sub,
        topics,
        db=MagicMock(),
        hot_of_day=hot,
    )
    assert "Microsoft agent story" in html
    assert "Pulse of Technology" in html
    assert "pots_logo_new.png" in html
    assert 'href="https://pulseone.com"' in html
    assert "twitter.com/intent/tweet" in html
    assert "mailto:?" in html
    assert "Hot on your radar" in html
    assert "Second story" in html
    # Logo + hot lead image only; do not add another lead image to the remaining top story.
    assert html.count("<img") == 2


def test_build_html_hot_lead_shows_when_hot_topic_not_in_subscriber_topics():
    """Global hot lead is editorial: subscribers see it even if that topic is outside their rollup."""
    hot = {
        "hot_topic": {"id": 99, "name": "Other", "domain": "AI", "subdomain": ""},
        "hot_article": {
            "title": "Breaking global briefing lead",
            "url": "https://example.com/y",
            "source_name": "X",
            "ingested_at": datetime(2026, 4, 13, tzinfo=UTC),
        },
    }
    topics = [
        SimpleNamespace(id=1, name="Mine", domain="AI", urgency_score=9.0, summary="A."),
    ]
    sub = _sub()
    html = email_service._build_html(
        sub,
        topics,
        db=MagicMock(),
        hot_of_day=hot,
    )
    assert "Breaking global briefing lead" in html
    assert "Hot on your radar" in html
    assert "Pulse of Technology" in html
    assert "pots_logo_new.png" in html


def test_newsletter_subject_uses_hot_article_title():
    hot = {
        "hot_topic": {"id": 1, "name": "T", "domain": "AI", "subdomain": ""},
        "hot_article": {
            "title": "SpaceX bleeds billions to fund xAI",
            "url": "https://example.com/",
            "source_name": "Example",
            "ingested_at": datetime(2026, 4, 13, tzinfo=UTC),
        },
    }
    topics = [SimpleNamespace(id=1, name="T", domain="AI", urgency_score=9.0, summary=".")]
    subj, headline = email_service._newsletter_subject_and_headline(topics, [], hot)
    assert "SpaceX bleeds billions" in subj
    assert "Pulse of Technology Daily" in subj
    assert headline == "SpaceX bleeds billions to fund xAI"


def test_hot_topic_lead_uses_domain_image_fallback():
    html = email_service._build_hot_topic_lead_html(
        {"name": "AI Agents", "domain": "AI", "subdomain": "Deployment"},
        {
            "title": "Agent story",
            "url": "https://example.com/agent",
            "source_name": "Example",
            "ingested_at": None,
            "image_url": None,
        },
    )

    assert "<img" in html
    assert "images.unsplash.com" in html


def test_radar_explore_url_points_to_radar_page_with_domain_filter():
    url = email_service._radar_explore_url("https://pulse.example.com", "Security")

    assert url == "https://pulse.example.com/radar?domain=Security#radar"


def test_hot_topic_lead_includes_short_article_summary_sections():
    html = email_service._build_hot_topic_lead_html(
        {"name": "AI Agents", "domain": "AI", "subdomain": "Deployment"},
        {
            "title": "AWS unveils AI deployment updates",
            "url": "https://example.com/aws-ai",
            "source_name": "Computerworld",
            "ingested_at": None,
            "image_url": None,
            "what_is_it": "AWS announced a coordinated set of services for agent deployment. Extra detail should not appear.",
            "why_it_matters": "Executives get a clearer signal that agent infrastructure is moving into production buying cycles. Extra detail should not appear.",
        },
    )

    assert "What is it?" in html
    assert "Why is it important?" in html
    assert "AWS announced a coordinated set of services for agent deployment." in html
    assert "Executives get a clearer signal" in html
    assert "Extra detail should not appear" not in html


def test_newsletter_footer_linkedin_points_to_pulseone_group():
    sub = _sub()
    html = email_service._build_html(sub, [_topic()], db=None)
    assert (
        "https://www.linkedin.com/company/pulseone-group-llc/people/?viewAsMember=true"
        in html
    )
    assert "linkedin.com/company/pulseone\"" not in html
    assert "linkedin.com/company/pulseone/" not in html


def test_newsletter_footer_has_signed_preferences_links():
    sub = _sub(email="reader@example.com")
    html = email_service._build_html(sub, [_topic()], db=None)

    assert "/preferences?token=" in html
    assert "unsubscribe=1" in html
    assert "reader@example.com" not in html


def test_send_daily_newsletter_persists_read_online_issue(db_session, monkeypatch):
    monkeypatch.setattr(email_service.settings, "sendgrid_api_key", "test-key")
    monkeypatch.setattr(email_service.settings, "api_base_url", "http://localhost:8100")
    sub = Subscriber(
        email="reader@example.com",
        first_name="Reader",
        last_name="One",
        industries=["Technology"],
        domains=None,
        role_ids=None,
        is_active=True,
    )
    db_session.add(sub)
    db_session.commit()
    mock_sg = MagicMock()
    mock_sg.send.return_value = MagicMock(status_code=202)

    with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
        ok, err = email_service.send_daily_newsletter(sub, [_topic()], db=db_session)

    assert ok is True
    assert err is None
    issue = db_session.query(NewsletterIssue).one()
    assert issue.subscriber_email == "reader@example.com"
    assert issue.subject
    assert f"http://localhost:8100/api/newsletter/issues/{issue.token}" in issue.html


# ---------------------------------------------------------------------------
# assemble_promoted_content — focus tags + rotation
# ---------------------------------------------------------------------------


def _content(
    title: str,
    tags: list[str],
    *,
    created_at: datetime | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=title,
        title=title,
        url="https://pulseone.com/contact-us/",
        type="landing_page",
        summary=title,
        image_url=f"/marketplace-offers/{title}.png",
        tags=tags,
        is_active=True,
        created_at=created_at or datetime(2026, 8, 1, tzinfo=UTC),
    )


def test_assemble_promoted_content_prefers_focus_domain_and_rotates_daily():
    security_a = _content("Sec A", ["Marketplace", "Security"])
    security_b = _content("Sec B", ["Marketplace", "Security"])
    ai_only = _content("AI Only", ["Marketplace", "AI"])
    stub = _content("Old Stub", ["Services"])

    mock_db = MagicMock()
    q = MagicMock()
    q.filter.return_value.order_by.return_value.all.return_value = [
        security_a,
        security_b,
        ai_only,
        stub,
    ]
    mock_db.query.return_value = q

    sub = _sub(domains=["Security"], id=42)
    day1 = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    day2 = datetime(2026, 8, 13, 12, 0, tzinfo=UTC)

    with patch.object(email_service, "_resolve_subscriber_roles", return_value=[]):
        pick1 = email_service.assemble_promoted_content(sub, mock_db, now=day1)
        pick2 = email_service.assemble_promoted_content(sub, mock_db, now=day2)

    assert len(pick1) == 1
    assert pick1[0].title in {"Sec A", "Sec B"}
    assert pick1[0].title != "AI Only"
    assert pick2[0].title in {"Sec A", "Sec B"}
    # Different calendar days should advance the rotation seed.
    assert {pick1[0].title, pick2[0].title} == {"Sec A", "Sec B"}


def test_assemble_promoted_content_falls_back_to_marketplace_pool():
    market = _content("Market Offer", ["Marketplace", "Cloud"])
    other = _content("Blog", ["Services"])
    mock_db = MagicMock()
    q = MagicMock()
    q.filter.return_value.order_by.return_value.all.return_value = [other, market]
    mock_db.query.return_value = q

    sub = _sub(domains=None, id=7)
    with patch.object(email_service, "_resolve_subscriber_roles", return_value=[]):
        picks = email_service.assemble_promoted_content(sub, mock_db)

    assert len(picks) == 1
    assert picks[0].title == "Market Offer"


def test_absolute_public_url_resolves_relative_marketplace_path(monkeypatch):
    monkeypatch.setattr(email_service.settings, "public_site_url", "http://localhost:3100")
    assert (
        email_service._absolute_public_url("/marketplace-offers/PulseOne_01_promo_1280x720.png")
        == "http://localhost:3100/marketplace-offers/PulseOne_01_promo_1280x720.png"
    )


def test_promo_section_labels_landing_page_as_get_more_information():
    item = _content("AI Readiness Assessment", ["Marketplace", "AI"])
    html = email_service._build_promo_section([item])
    assert "Get More Information" in html
    assert "Landing Page" not in html
