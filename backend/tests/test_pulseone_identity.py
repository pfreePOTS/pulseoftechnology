"""PulseOne identity document and advisor prompt composition."""

from __future__ import annotations

from backend.services.ai_service import path_synthesis_system_prompt
from backend.services.pulseone_identity import (
    build_advisor_system_prompt,
    clear_pulseone_identity_cache,
    load_pulseone_identity,
    pulseone_identity_path,
)


def test_identity_file_exists_and_covers_scope():
    path = pulseone_identity_path()
    assert path.is_file(), path
    body = load_pulseone_identity()
    assert "remote support for our restaurants" in body
    assert "Software integration" in body
    assert "operational/production equipment" in body
    assert "Website management" in body


def test_build_advisor_system_prompt_prepends_identity():
    clear_pulseone_identity_cache()
    composed = build_advisor_system_prompt("TASK: respond with JSON only.")
    assert "PulseOne identity" in composed
    assert "TASK: respond with JSON only." in composed
    assert load_pulseone_identity().splitlines()[0] in composed


def test_path_synthesis_system_includes_identity_and_task():
    clear_pulseone_identity_cache()
    prompt = path_synthesis_system_prompt()
    assert "engagement_examples" in prompt
    assert "phone / VoIP" in prompt or "Phone / VoIP" in prompt
    assert "operational equipment boundary" in prompt.lower() or "Operational equipment" in prompt
    assert "how we would help" in prompt.lower() or "how PulseOne would" in prompt
