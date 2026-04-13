"""Tests for RSS ingestion language gating."""

from ..services.ingestion import _is_english_for_ingest


def test_korean_title_rejected_even_with_english_summary():
    title = "기업 52% 생성형 AI 활용... 보안·거버넌스 구축은 미진"
    summary = (
        "OpenText surveyed enterprises and found that over half use generative AI "
        "while security and governance remain immature across the board."
    )
    assert _is_english_for_ingest(title, summary) is False


def test_english_title_and_summary_accepted():
    title = "How to Evaluate AI SOC Agents: 7 Questions Gartner Says You Should Be Asking"
    summary = "Security operations centers are evaluating AI-driven agents."
    assert _is_english_for_ingest(title, summary) is True


def test_short_english_title_with_minimal_body_allowed():
    assert _is_english_for_ingest("AI", None) is True


def test_empty_title_rejected():
    assert _is_english_for_ingest("", "Some English body text here.") is False
