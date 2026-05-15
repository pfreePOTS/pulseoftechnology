"""Shared helpers for English-product language gating (RSS, newsletters, cleanup)."""

from __future__ import annotations

import re

# Korean syllable block (Hangul) — titles containing these are excluded from English surfaces.
_HANGUL_SYLLABLE_RE = re.compile(r"[\uAC00-\uD7A3]")

# Any character from a script we treat as definitive non-English: Hangul, CJK
# ideographs (Chinese / shared Japanese), Hiragana, Katakana, Cyrillic, Greek,
# Hebrew, Arabic, Devanagari, Bengali, Thai. A single such character in a title
# (or substantial sample) is a hard reject — we publish English-only surfaces.
_NON_LATIN_SCRIPT_RE = re.compile(
    "["
    "\u0370-\u03ff"  # Greek
    "\u0400-\u04ff"  # Cyrillic
    "\u0590-\u05ff"  # Hebrew
    "\u0600-\u06ff"  # Arabic
    "\u0900-\u097f"  # Devanagari
    "\u0980-\u09ff"  # Bengali
    "\u0e00-\u0e7f"  # Thai
    "\u3040-\u309f"  # Hiragana
    "\u30a0-\u30ff"  # Katakana
    "\u3400-\u4dbf"  # CJK Extension A
    "\u4e00-\u9fff"  # CJK Unified Ideographs
    "\uac00-\ud7a3"  # Hangul syllables
    "]"
)


def title_contains_hangul(title: str | None) -> bool:
    """True if *title* contains at least one Hangul syllable (common case: Korean headlines)."""
    if not title or not str(title).strip():
        return False
    return bool(_HANGUL_SYLLABLE_RE.search(str(title)))


def contains_non_latin_script(text: str | None) -> bool:
    """True if *text* contains any character from a non-Latin script we treat as non-English."""
    if not text or not str(text).strip():
        return False
    return bool(_NON_LATIN_SCRIPT_RE.search(str(text)))
