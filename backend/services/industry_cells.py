"""Per-industry Analysis grid cells (``Topic.industry_positions`` values).

Each cell carries a ``source``:

- ``placeholder`` — backfill so every industry column exists; never analyzed, never public.
- ``ai`` — written by the Industry Positioning agent; replaced on the next AI run.
- ``manual`` — edited by a curator; AI runs never overwrite it.

Rows written before ``source`` existed are classified by their stored placeholder copy.
"""

from __future__ import annotations

from typing import Any

SOURCE_PLACEHOLDER = "placeholder"
SOURCE_AI = "ai"
SOURCE_MANUAL = "manual"

PLACEHOLDER_TEXT: dict[str, str] = {
    "rationale": (
        "Included so this topic appears across all industries on the radar. "
        "Adjust impact, risk, and adoption per sector as needed."
    ),
    "industry_impact": (
        "Placeholder — run AI Suggest on this topic to generate sector-specific impact analysis."
    ),
    "scoring_rationale": (
        "Placeholder — scores match topic-level urgency until you refine per industry."
    ),
    "phase_rationale": "Placeholder — adoption stage matches topic default until you refine.",
    "remediation": "Review impact and risk for this sector, then set program priorities accordingly.",
}

_CONTENT_KEYS = (
    "impact_score",
    "risk_level",
    "urgency_score",
    "adoption_state",
    "industry_impact",
    "rationale",
    "scoring_rationale",
    "phase_rationale",
    "remediation",
)


def _is_placeholder_text(key: str, value: Any) -> bool:
    if not isinstance(value, str):
        return False
    v = value.strip()
    return bool(v) and (v == PLACEHOLDER_TEXT.get(key) or v.startswith("Placeholder —"))


def is_placeholder_cell(row: Any) -> bool:
    """True when the cell is backfill rather than AI or curator analysis."""
    if not isinstance(row, dict):
        return True
    source = row.get("source")
    if source == SOURCE_PLACEHOLDER:
        return True
    if source in (SOURCE_AI, SOURCE_MANUAL):
        return False
    return _is_placeholder_text("industry_impact", row.get("industry_impact")) or (
        _is_placeholder_text("rationale", row.get("rationale"))
    )


def live_industry_positions(ip: Any) -> dict[str, Any]:
    """Cells that may face the public: analyzed and not unchecked from the radar."""
    if not isinstance(ip, dict):
        return {}
    return {
        k: v
        for k, v in ip.items()
        if isinstance(v, dict)
        and not is_placeholder_cell(v)
        and v.get("impact_approved") is not False
    }


def merge_ai_industry_rows(existing: Any, suggestions: dict[str, Any]) -> dict[str, Any]:
    """Apply an AI run: keep manual cells and any cell the model did not return."""
    out: dict[str, Any] = dict(existing) if isinstance(existing, dict) else {}
    for label, row in suggestions.items():
        if not isinstance(row, dict) or is_placeholder_cell(row):
            continue
        prev = out.get(label)
        if isinstance(prev, dict) and prev.get("source") == SOURCE_MANUAL:
            continue
        new = dict(row)
        new["source"] = SOURCE_AI
        unchecked = (
            isinstance(prev, dict)
            and not is_placeholder_cell(prev)
            and prev.get("impact_approved") is False
        )
        new["impact_approved"] = not unchecked
        out[label] = new
    return out


def _same_value(a: Any, b: Any) -> bool:
    if a in (None, "") and b in (None, ""):
        return True
    if isinstance(a, int | float) and isinstance(b, int | float):
        return abs(float(a) - float(b)) < 1e-9
    return a == b


def apply_curator_edits(stored: Any, incoming: dict[str, Any]) -> dict[str, Any]:
    """Mark cells whose scores, phase, or text changed as ``manual``; keep others' source."""
    prev_map = stored if isinstance(stored, dict) else {}
    out: dict[str, Any] = {}
    for label, row in incoming.items():
        if not isinstance(row, dict):
            out[label] = row
            continue
        new = dict(row)
        prev = prev_map.get(label)
        unchanged = isinstance(prev, dict) and all(
            _same_value(prev.get(k), new.get(k)) for k in _CONTENT_KEYS
        )
        if unchanged:
            if "source" in prev:
                new["source"] = prev["source"]
            else:
                new.pop("source", None)
        else:
            new["source"] = SOURCE_MANUAL
            for k in PLACEHOLDER_TEXT:
                if _is_placeholder_text(k, new.get(k)):
                    new.pop(k, None)
        if is_placeholder_cell(new):
            new["impact_approved"] = False
        out[label] = new
    return out
