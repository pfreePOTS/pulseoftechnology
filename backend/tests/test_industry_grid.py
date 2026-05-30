"""Industry grid backfill — full radar columns when AI returns partial JSON."""

from backend.models.topic import AdoptionState, Topic, TopicStatus
from backend.services.ai_service import (
    INDUSTRY_GRID_LABELS,
    _truncate_to_max_sentences,
    fill_missing_industry_grid_rows,
)


def test_fill_missing_industry_grid_rows_preserves_existing_and_fills_rest():
    t = Topic(
        name="Leadership",
        domain_id=1,
        urgency_score=8.5,
        adoption_state=AdoptionState.learn_about,
        status=TopicStatus.selected,
    )
    sparse = {
        "Technology": {
            "impact_score": 9.0,
            "risk_level": 6.0,
            "adoption_state": "Learn About",
            "rationale": "Tech sector detail",
        }
    }
    out = fill_missing_industry_grid_rows(t, sparse)
    assert out["Technology"]["impact_score"] == 9.0
    assert out["Technology"]["rationale"] == "Tech sector detail"
    assert len(out) == len(INDUSTRY_GRID_LABELS)
    assert "Healthcare" in out
    assert out["Healthcare"]["impact_score"] == 8.5
    assert "Included so this topic appears across all industries" in (
        out["Healthcare"].get("rationale") or ""
    )


def test_truncate_to_max_sentences_keeps_short_and_caps_long():
    assert _truncate_to_max_sentences("One. Two.", 6) == "One. Two."
    long = " ".join(f"Sentence {i}." for i in range(1, 12))
    out = _truncate_to_max_sentences(long, 6)
    assert out.count(".") == 6
    assert out.startswith("Sentence 1.")
