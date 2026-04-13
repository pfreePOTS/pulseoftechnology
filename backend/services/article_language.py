"""Shared helpers for English-product language gating (RSS, newsletters, cleanup)."""

from __future__ import annotations

import re

# Korean syllable block (Hangul) — titles containing these are excluded from English surfaces.
_HANGUL_SYLLABLE_RE = re.compile(r"[\uAC00-\uD7A3]")


def title_contains_hangul(title: str | None) -> bool:
    """True if *title* contains at least one Hangul syllable (common case: Korean headlines)."""
    if not title or not str(title).strip():
        return False
    return bool(_HANGUL_SYLLABLE_RE.search(str(title)))
