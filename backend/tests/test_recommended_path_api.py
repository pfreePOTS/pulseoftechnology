"""Public recommended-path API — skip_ai returns deterministic payload without LLM."""

from __future__ import annotations


def test_recommended_path_skip_ai_has_experience_and_synthesis(client):
    r = client.get(
        "/api/recommended-path",
        params={"industry": "Energy", "role": "COO", "skip_ai": True},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("headline")
    assert data.get("synthesis")
    assert (data.get("synthesis_html") or "").strip()
    items = data.get("experience_items") or []
    assert len(items) >= 1
    assert all(
        str(it.get("title", "")).strip() and str(it.get("description", "")).strip() for it in items
    )
    assert all(str(it.get("icon", "")).strip() for it in items)
