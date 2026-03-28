"""Unit tests for backend/services/email_service.py."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ..services import email_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sub(**kw) -> SimpleNamespace:
    defaults = dict(
        id=1,
        email="jane@example.com",
        first_name="Jane",
        last_name="Smith",
        industry="Technology",
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
            result = email_service.send_daily_newsletter(
                _sub(), [_topic()]
            )

        assert result is True
        mock_sg.send.assert_called_once()

    def test_returns_false_on_non_202(self):
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(400)

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            result = email_service.send_daily_newsletter(_sub(), [_topic()])

        assert result is False

    def test_returns_false_on_exception(self):
        mock_sg = MagicMock()
        mock_sg.send.side_effect = Exception("Network error")

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            result = email_service.send_daily_newsletter(_sub(), [_topic()])

        assert result is False

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

    def test_subject_includes_topic_count(self):
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)
        topics = [_topic("AI", 9.0, "Topic A"), _topic("Security", 7.0, "Topic B")]

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            email_service.send_daily_newsletter(_sub(), topics)

        mail_obj = mock_sg.send.call_args.args[0]
        mail_dict = mail_obj.get()
        assert "2 signals" in str(mail_dict)

    def test_uses_dynamic_template_when_configured(self, monkeypatch):
        monkeypatch.setattr(
            email_service.settings, "sendgrid_newsletter_template_id", "d-abc123"
        )
        mock_sg = MagicMock()
        mock_sg.send.return_value = self._mock_response(202)

        with patch.object(email_service, "_get_sg_client", return_value=mock_sg):
            email_service.send_daily_newsletter(_sub(), [_topic()])

        mail_obj = mock_sg.send.call_args.args[0]
        # TemplateId is a wrapper object; access its .get() value
        assert mail_obj.template_id.get() == "d-abc123"


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

    def test_returns_all_when_no_domain_preference(self):
        sub = _sub(domains=None)
        topics = [_topic("AI"), _topic("Security"), _topic("Finance")]
        result = email_service.assemble_newsletter_topics(sub, topics)
        assert len(result) == 3

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


# ---------------------------------------------------------------------------
# run_daily_newsletter integration
# ---------------------------------------------------------------------------

class TestRunDailyNewsletter:
    def test_skips_when_no_recent_topics(self):
        mock_db = MagicMock()
        # Simulate no recent topics returned by the query
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = []

        with patch.object(email_service, "send_daily_newsletter") as mock_send:
            email_service.run_daily_newsletter(mock_db)

        mock_send.assert_not_called()

    def test_sends_to_matching_subscribers(self):
        sub = _sub(domains=["AI"])
        topic = _topic("AI", 9.0)

        mock_db = MagicMock()
        # First query returns approved topics, second returns subscribers
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = [topic]
        mock_db.query.return_value.filter.return_value.all.return_value = [sub]

        with patch.object(email_service, "send_daily_newsletter", return_value=True) as mock_send:
            email_service.run_daily_newsletter(mock_db)

        mock_send.assert_called_once_with(sub, [topic])

    def test_skips_subscriber_with_no_matching_domains(self):
        sub = _sub(domains=["Finance"])
        topic = _topic("AI", 9.0)

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = [topic]
        mock_db.query.return_value.filter.return_value.all.return_value = [sub]

        with patch.object(email_service, "send_daily_newsletter") as mock_send:
            email_service.run_daily_newsletter(mock_db)

        mock_send.assert_not_called()
