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
    cards = data.get("synthesis_cards") or []
    assert len(cards) == 4
    assert [str(c.get("title", "")) for c in cards] == ["Understand", "Recommend", "Implement", "Manage"]
    for ws in data.get("watch_stories") or []:
        assert "image_url" in ws


def test_recommended_path_skip_ai_does_not_set_hero_urls(client):
    r = client.get(
        "/api/recommended-path",
        params={"industry": "Energy", "role": "COO", "skip_ai": True},
    )
    assert r.status_code == 200, r.text
    for card in r.json().get("synthesis_cards") or []:
        assert card.get("hero_image_url") is None


def test_recommended_path_skip_ai_remote_stage_surfaces_operational_cards(client):
    r = client.get(
        "/api/recommended-path",
        params={
            "industry": "Education",
            "role": "CFO",
            "issue": "Microsoft license management",
            "stage": "We're looking for support for our remote offices.",
            "skip_ai": True,
        },
    )
    assert r.status_code == 200, r.text
    blob = " ".join(str(it.get("title", "")) for it in (r.json().get("experience_items") or [])).lower()
    assert "remote" in blob or "help desk" in blob or "monitoring" in blob


def test_recommended_path_defer_articles_omits_watch_rows(client):
    r = client.get(
        "/api/recommended-path",
        params={
            "industry": "Energy",
            "role": "COO",
            "skip_ai": True,
            "defer_articles": True,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json().get("watch_stories") == []


def test_recommended_path_watch_stories_endpoint_returns_shape(client):
    r = client.get("/api/recommended-path/watch-stories", params={"industry": "Education"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "watch_stories" in data
    assert isinstance(data["watch_stories"], list)
    for ws in data["watch_stories"]:
        assert "title" in ws and "url" in ws
        assert "image_url" in ws
