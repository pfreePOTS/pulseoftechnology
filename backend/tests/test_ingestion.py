"""Tests for RSS ingestion language gating and Open Graph image fallback."""

from ..services import ingestion
from ..services.ingestion import _is_english_for_ingest, _scrape_og_image


class _FakeResponse:
    """Minimal stand-in for `httpx.Response` used by the OG scraper."""

    def __init__(self, *, content: bytes = b"", content_type: str = "text/html"):
        self.content = content
        self.headers = {"Content-Type": content_type}

    def raise_for_status(self) -> None:
        return None


class _FakeClient:
    """Context-manager `httpx.Client` double whose `.get` returns a queued response.

    Lets us drive `_scrape_og_image` without touching the network or pulling
    in another mocking dependency just for these tests."""

    def __init__(self, response: _FakeResponse | Exception):
        self._response = response

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def get(self, url: str) -> _FakeResponse:
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


def _patch_httpx(monkeypatch, response: _FakeResponse | Exception) -> None:
    monkeypatch.setattr(ingestion.httpx, "Client", lambda *args, **kwargs: _FakeClient(response))


def test_korean_title_rejected_even_with_english_summary():
    title = "기업 52% 생성형 AI 활용... 보안·거버넌스 구축은 미진"
    summary = (
        "OpenText surveyed enterprises and found that over half use generative AI "
        "while security and governance remain immature across the board."
    )
    assert _is_english_for_ingest(title, summary) is False


def test_english_title_and_summary_accepted():
    title = "How to Evaluate AI SOC Agents: 7 Questions Gartner Says You Should Be Asking"
    summary = "Security operations centers are evaluating AI-driven agents."
    assert _is_english_for_ingest(title, summary) is True


def test_short_english_title_with_minimal_body_allowed():
    assert _is_english_for_ingest("AI", None) is True


def test_empty_title_rejected():
    assert _is_english_for_ingest("", "Some English body text here.") is False


def test_scrape_og_image_returns_og_image_meta(monkeypatch):
    html = b"""
    <html><head>
      <meta property="og:image" content="https://example.com/lead.jpg" />
      <meta name="twitter:image" content="https://example.com/twitter.jpg" />
    </head><body>ok</body></html>
    """
    _patch_httpx(monkeypatch, _FakeResponse(content=html))

    assert _scrape_og_image("https://example.com/article") == "https://example.com/lead.jpg"


def test_scrape_og_image_falls_back_to_twitter_image(monkeypatch):
    html = b"""
    <html><head>
      <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg" />
    </head></html>
    """
    _patch_httpx(monkeypatch, _FakeResponse(content=html))

    assert _scrape_og_image("https://example.com/x") == "https://cdn.example.com/twitter.jpg"


def test_scrape_og_image_rejects_non_html_content_type(monkeypatch):
    _patch_httpx(
        monkeypatch,
        _FakeResponse(content=b"binary blob", content_type="application/octet-stream"),
    )
    assert _scrape_og_image("https://example.com/x") is None


def test_scrape_og_image_rejects_relative_or_non_http_meta(monkeypatch):
    html = b"""
    <html><head>
      <meta property="og:image" content="/relative/lead.jpg" />
      <meta name="twitter:image" content="javascript:alert(1)" />
    </head></html>
    """
    _patch_httpx(monkeypatch, _FakeResponse(content=html))
    assert _scrape_og_image("https://example.com/x") is None


def test_scrape_og_image_rejects_non_http_url():
    assert _scrape_og_image("javascript:alert(1)") is None
    assert _scrape_og_image("") is None


def test_scrape_og_image_swallows_network_errors(monkeypatch):
    _patch_httpx(monkeypatch, RuntimeError("boom"))
    assert _scrape_og_image("https://example.com/x") is None


def test_scrape_og_image_returns_none_when_no_meta(monkeypatch):
    _patch_httpx(monkeypatch, _FakeResponse(content=b"<html><head></head></html>"))
    assert _scrape_og_image("https://example.com/x") is None
