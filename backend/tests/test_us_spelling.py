"""Site copy, prompts, and seed content use US English spelling."""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import patch

from backend.services import llm_client

BACKEND = Path(__file__).resolve().parents[1]

BRITISH_SPELLING = re.compile(
    r"\b(?:organisation(?:al|s)?|organis(?:e|ed|es|ing)|personalis(?:e|ed|es|ing|ation)"
    r"|prioritis(?:e|ed|es|ing)|deprioritis(?:e|ed|ing)|optimis(?:e|ed|es|ing|ation)|unoptimised"
    r"|modernis(?:e|ed|ing|ation)|summaris(?:e|ed|es|ing|ation)|minimis(?:e|ed|ing|ation)"
    r"|maximis(?:e|ed|ing)|authoris(?:e|ed|ing|ation)|scrutinis(?:e|ed|ing)|specialis(?:e|ed|ing)"
    r"|synthesis(?:ed|ing)|generalis(?:e|ed|ing)|serialis(?:e|ed|ing)|normalis(?:e|ed|ing|ation)"
    r"|publicis(?:e|ed)|recognis(?:e|ed|es|ing)|realis(?:e|ed|es|ing)|colours?|behaviours?"
    r"|favour(?:s|ed|ite)?|centres?|programmes?|catalogues?|licence|defence|labell(?:ed|ing)"
    r"|grey|fulfilment)\b",
    re.IGNORECASE,
)

# Model output parser accepts either spelling of the verdict.
ALLOWED = {("services/signal_service.py", "deprioritise")}


def test_backend_source_and_content_use_us_spelling():
    files = [
        p
        for p in [*BACKEND.rglob("*.py"), *BACKEND.rglob("*.md")]
        if not {"tests", "alembic", "__pycache__", ".venv", "venv"}
        & set(p.relative_to(BACKEND).parts)
    ]
    hits = []
    for path in files:
        rel = path.relative_to(BACKEND).as_posix()
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for m in BRITISH_SPELLING.finditer(line):
                if (rel, m.group(0).lower()) not in ALLOWED:
                    hits.append(f"{rel}:{n} {m.group(0)}")
    assert hits == []


def test_every_llm_call_asks_for_us_spelling():
    with (
        patch.object(llm_client, "is_llm_configured", return_value=True),
        patch.object(llm_client, "_deepseek_configured", return_value=True),
        patch.object(llm_client, "_deepseek_circuit_open", return_value=False),
        patch.object(llm_client, "_complete_deepseek", return_value=("ok", 1)) as complete,
    ):
        llm_client.chat_completion_result("m", system="Write a summary.", user="u", max_tokens=8)
    system = complete.call_args.kwargs["system"]
    assert system.startswith("Write a summary.")
    assert "American English" in system
