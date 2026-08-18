"""Intake agents default to DeepSeek Flash so hourly JSON calls do not pay Pro rates."""

from ..services import ai_service

_INTAKE = (
    "gate",
    "classify",
    "score",
    "cluster",
    "summarize_node_legacy",
    "summarize_node_persona",
)

_PRO_QUALITY = (
    "summarize_topic",
    "topic_level_persona",
    "industry_positioning",
)


def test_intake_default_models_are_flash():
    assert ai_service.HAIKU_MODEL == "deepseek-v4-flash"
    assert ai_service.INTAKE_AGENTS == frozenset(_INTAKE)
    for name in _INTAKE:
        assert ai_service.default_model_for_agent(name) == "deepseek-v4-flash", name


def test_quality_nodes_stay_on_pro():
    assert ai_service.SONNET_MODEL == "deepseek-v4-pro"
    for name in _PRO_QUALITY:
        assert ai_service.default_model_for_agent(name) == "deepseek-v4-pro", name


def test_prompt_seed_uses_flash_for_intake_agents():
    by_name = {row["agent_name"]: row["model"] for row in ai_service.PROMPT_TEMPLATE_SEED_V1}
    for name in _INTAKE:
        assert by_name[name] == "deepseek-v4-flash", name
    for name in _PRO_QUALITY:
        if name in by_name:
            assert by_name[name] == "deepseek-v4-pro", name
