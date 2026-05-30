"""Coercion for PulseOne in Action vignettes on recommended-path."""

from __future__ import annotations

from backend.services.ai_service import _coerce_engagement_examples, path_synthesis_system_prompt
from backend.services.pulseone_identity import clear_pulseone_identity_cache, load_pulseone_identity


def test_identity_file_defines_it_scope_for_agents():
    body = load_pulseone_identity()
    assert "multi-site IT support" in body
    assert "robotics" in body


def test_path_synthesis_prompt_loads_identity_block():
    clear_pulseone_identity_cache()
    prompt = path_synthesis_system_prompt()
    assert "remote support for our restaurants" in prompt
    assert "engagement_examples" in prompt


def test_coerce_engagement_examples_requires_three_with_title():
    raw = [
        {
            "pattern": "governance-sprint",
            "title": "Posture sprint before renewal",
            "who": "CFO and CISO",
            "provided": "Board-ready narrative",
            "approach": "A",
            "solution": "B",
            "how_we_helped": "C",
        },
        {
            "pattern": "ops-ai-sequencing",
            "title": "Remote office connectivity standard",
            "who": "IT director",
            "provided": "Playbook rollout",
        },
        {
            "title": "Field support model",
            "who": "COO",
            "provided": "Escalation paths",
            "pattern": "fractional-office",
        },
    ]
    out = _coerce_engagement_examples(raw)
    assert len(out) == 3
    assert out[0]["id"] == "governance-sprint"
    assert "Remote office" in out[1]["title"]


def test_coerce_engagement_examples_caps_at_three():
    assert len(_coerce_engagement_examples([{"title": "Only one"}])) == 1
