"""Load PulseOne business identity for customer-facing advisor LLM prompts."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_IDENTITY_FILE = Path(__file__).resolve().parent.parent / "content" / "pulseone-identity.md"

_IDENTITY_HEADER = """\
The following PulseOne identity block is authoritative for who we are, what we deliver, \
what we do not deliver, and how we sound. Obey it for all tasks below.
"""


def pulseone_identity_path() -> Path:
    """Filesystem path to the canonical identity document (for editors and tests)."""
    return _IDENTITY_FILE


@lru_cache(maxsize=1)
def load_pulseone_identity() -> str:
    """Return the identity markdown body (cached). Raises if the file is missing."""
    path = pulseone_identity_path()
    if not path.is_file():
        raise FileNotFoundError(f"PulseOne identity file not found: {path}")
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"PulseOne identity file is empty: {path}")
    return text


def clear_pulseone_identity_cache() -> None:
    """Invalidate cached identity and composed advisor prompts (tests or hot reload in dev)."""
    load_pulseone_identity.cache_clear()
    try:
        from . import ai_service

        ai_service.path_synthesis_system_prompt.cache_clear()
        ai_service.everyone_overview_system_prompt.cache_clear()
    except Exception:
        pass


def build_advisor_system_prompt(task_instructions: str) -> str:
    """
    Compose a full system prompt: shared identity + task-specific JSON/schema rules.

    Used by recommended-path synthesis, everyone overview, and future advisor agents.
    """
    identity = load_pulseone_identity()
    task = task_instructions.strip()
    return f"{_IDENTITY_HEADER}\n\n{identity}\n\n---\n\n{task}"
