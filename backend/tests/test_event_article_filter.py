"""Promotional webinar / virtual-event heuristic used at ingest and hot-topic."""

from backend.services.event_article_filter import (
    looks_like_promotional_event,
    split_article_title_body_for_pipeline,
)


class TestLooksLikePromotionalEvent:
    def test_divelive_virtual_event_title(self):
        t = "[DiveLive Virtual Event] How AI is reshaping the enterprise"
        b = "A virtual event exploring how artificial intelligence transforms business..."
        assert looks_like_promotional_event(t, b) is True

    def test_plain_tech_analysis_not_flagged(self):
        t = "How enterprises are reshaping AI adoption"
        b = "CIO survey shows shift toward agentic tooling and governance benchmarks."
        assert looks_like_promotional_event(t, b) is False

    def test_register_requires_event_context_nearby(self):
        assert looks_like_promotional_event("Register for our AI webinar tomorrow", "...") is True
        assert (
            looks_like_promotional_event("Banks register for Swift compliance deadline", "...")
            is False
        )


class TestSplitPipelineContent:
    def test_title_body_split(self):
        raw = "Title: Hello world\n\nBody line"
        title, body = split_article_title_body_for_pipeline(raw)
        assert title == "Hello world"
        assert body == "Body line"
