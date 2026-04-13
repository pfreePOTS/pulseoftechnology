"""Industry grid backfill — full radar columns when AI returns partial JSON."""

from ..models.topic import AdoptionState, Topic, TopicStatus
from ..services.ai_service import INDUSTRY_GRID_LABELS, fill_missing_industry_grid_rows


def test_fill_missing_industry_grid_rows_preserves_existing_and_fills_rest():
    t = Topic(
        name="Leadership",
        domain="Leadership",
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
    assert "Included so this topic appears across all industries" in (out["Healthcare"].get("rationale") or "")
