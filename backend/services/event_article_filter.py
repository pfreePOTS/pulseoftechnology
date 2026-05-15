"""
Heuristics to exclude vendor webinars, sponsored virtual events, and similar promos.

Used at RSS ingestion, before the relevance gate (saves tokens), and when scoring
coverage for the daily “hot topic” so promotions do not look like widespread press.
"""

from __future__ import annotations

import re

# Bracket teasers publishers use for webinars / summits (“[Virtual Event] …”).
_BRACKET_EVENT_RE = re.compile(
    r"(?i)\[[^\]\n]{1,260}?\b("
    r"webinar|virtual\s+event|live\s+event|on-?demand\s+event"
    r"|event\s*broadcast|\bsummit\b"
    r"|workshop"
    r"|roundtable|\bfiresides?\b"
    r"|dives?\s*live|divelive"
    r")\b[^\]\n]*]",
)

_PROMO_TAIL_RE = re.compile(r"(?ix)\|\s*(free\s+)?webinar\b")

_PHRASES = (
    "virtual event exploring",
    "virtual event:",
    "(virtual event",
    "join this webinar",
    "live webinar:",
    "upcoming webinar",
    "register for ",
    "register now",
    "rsvp ",
    "save your seat",
    "reserve your seat",
    "sign up today",
    "secure your spot",
    "free webinar",
    "complimentary webinar",
    "live virtual session",
)


def looks_like_promotional_event(title: str | None, body: str | None) -> bool:
    """
    Return True when the item is primarily a signup / attendance promo for someone else's event.

    Leaves plain “AI workshop reshapes…” analysis alone unless bracket / RSVP patterns match.
    """
    t = (title or "").strip()
    b = (body or "").strip()
    if not t and not b:
        return False

    if _BRACKET_EVENT_RE.search(t) or _BRACKET_EVENT_RE.search(b):
        return True
    if _PROMO_TAIL_RE.search(t):
        return True
    # Brand / common series promos outside brackets.
    low_t = t.lower()
    if "divelive" in low_t.replace(" ", "") or re.search(r"\bdive\s+live\b", low_t):
        return True

    hay = f"{t}\n{b}".lower()

    for p in _PHRASES:
        if p not in hay:
            continue
        if p == "register for ":
            span = hay.find(p)
            window = hay[max(0, span - 48) : span + len(p) + 80]
            if not re.search(
                r"\b(webinar|virtual|live\s+event|summit\b.*\bonline\b|streaming|broadcast)\b",
                window,
                re.I,
            ):
                continue
        return True

    if re.search(r"\bjoin\s+us\b", hay, re.I) and re.search(
        r"\b(webinar|virtual\s+event|live\s+stream)\b", hay, re.I
    ):
        return True
    return False


def split_article_title_body_for_pipeline(article_content: str) -> tuple[str, str]:
    """
    ``process_raw_articles`` wraps rows as ``Title: ...`` then newline(s) then the body excerpt.
    Normalise that here for promo heuristics and logging.
    """
    s = (article_content or "").lstrip()
    prefix = "title:"
    if s[: len(prefix)].lower() == prefix:
        rest = s[len(prefix) :].lstrip()
        if "\n" in rest:
            t, _, body = rest.partition("\n")
            return t.strip(), body.strip()
        return rest.strip(), ""
    return "", s.strip()


def article_excluded_from_news_coverage_signals(
    *,
    title: str | None,
    content: str | None,
    summary: str | None = None,
) -> bool:
    """Exclude from hot-topic editorial coverage counts (promos are not independent press signals)."""
    parts = [title or "", summary or "", content or ""]
    blob = "\n".join(x for x in parts if x.strip())
    return looks_like_promotional_event(title, blob or None)
