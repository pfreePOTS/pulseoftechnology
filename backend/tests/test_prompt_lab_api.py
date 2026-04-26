"""Prompt Lab admin API contracts."""

from backend.dependencies import ADMIN_COOKIE_NAME, create_admin_access_token
from backend.models.admin_user import AdminUser
from backend.models.prompt import PromptProposal, PromptTemplate


def _login(client, db_session):
    user = db_session.query(AdminUser).filter_by(email="pulseoneadmin@pulseone.local").one()
    client.cookies.set(ADMIN_COOKIE_NAME, create_admin_access_token(user))


def test_prompt_template_response_includes_model(client, db_session):
    db_session.add(
        PromptTemplate(
            agent_name="gate",
            version="1.0.0",
            system_prompt="Return JSON.",
            model="claude-haiku-4-5-20251001",
            is_active=True,
        )
    )
    db_session.commit()
    _login(client, db_session)

    r = client.get("/api/admin/prompt-templates?agent=gate")

    assert r.status_code == 200
    rows = r.json()
    assert rows[0]["model"] == "claude-haiku-4-5-20251001"


def test_create_prompt_proposal_from_registered_template(client, db_session):
    tpl = PromptTemplate(
        agent_name="gate",
        version="1.0.0",
        system_prompt="Return JSON.",
        model="claude-haiku-4-5-20251001",
        is_active=True,
    )
    db_session.add(tpl)
    db_session.commit()
    _login(client, db_session)

    r = client.post(
        "/api/admin/prompt-proposals",
        json={
            "template_id": tpl.id,
            "proposed_system_prompt": "Return strict JSON only.",
            "model": "claude-sonnet-4-6",
            "rationale": "Manual lab test",
        },
    )

    assert r.status_code == 201
    data = r.json()
    assert data["agent_name"] == "gate"
    assert data["base_version"] == "1.0.0"
    assert data["model"] == "claude-sonnet-4-6"
    assert data["status"] == "pending"


def test_patch_prompt_proposal_updates_prompt_and_model(client, db_session):
    proposal = PromptProposal(
        agent_name="gate",
        base_version="1.0.0",
        proposed_system_prompt="Old",
        model="claude-haiku-4-5-20251001",
        rationale="",
        test_improvement_score=None,
        status="pending",
    )
    db_session.add(proposal)
    db_session.commit()
    _login(client, db_session)

    r = client.patch(
        f"/api/admin/prompt-proposals/{proposal.id}",
        json={"proposed_system_prompt": "New", "model": "claude-sonnet-4-6"},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["proposed_system_prompt"] == "New"
    assert data["model"] == "claude-sonnet-4-6"


def test_prompt_model_list_has_fallback_models(client, db_session):
    _login(client, db_session)

    r = client.get("/api/admin/prompt-models")

    assert r.status_code == 200
    ids = [m["id"] for m in r.json()]
    assert "claude-haiku-4-5-20251001" in ids
    assert "claude-sonnet-4-6" in ids
