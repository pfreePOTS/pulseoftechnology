"""PULSE-028: banned brochure phrases must not reappear in backend identity / prompts."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

# Keep in sync with frontend/src/app/approach/voice.test.ts BANNED_PHRASES.
BANNED_PHRASES = [
    "best-in-class",
    "global IT services company",
    "Mid-Market Leaders",
    "mid-market leaders",
    "thought leader",
    "world-class",
    "world class",
]

_BACKEND = Path(__file__).resolve().parents[1]
_SCAN_FILES = [
    _BACKEND / "content" / "pulseone-identity.md",
    _BACKEND / "services" / "ai_service.py",
]

# Identity may name banned phrases only as examples to avoid.
_AVOID_LIST_LINE = re.compile(r"(?im)^[^\n]*\bavoid\b[^\n]*\n")


def _scan_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.name == "pulseone-identity.md":
        text = _AVOID_LIST_LINE.sub("", text)
    return text


@pytest.mark.parametrize("path", _SCAN_FILES, ids=lambda p: p.name)
def test_backend_customer_facing_copy_avoids_banned_brochure_phrases(path: Path):
    assert path.is_file(), f"missing scan target: {path}"
    text = _scan_text(path)
    offenders = [phrase for phrase in BANNED_PHRASES if phrase in text]
    assert offenders == [], f"{path.name} still contains {offenders}"
