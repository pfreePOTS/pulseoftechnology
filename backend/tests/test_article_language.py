from ..services.article_language import title_contains_hangul


def test_hangul_detected_in_title():
    assert title_contains_hangul("기업 52% 생성형 AI") is True


def test_ascii_title_not_hangul():
    assert title_contains_hangul("How to Evaluate AI SOC Agents") is False


def test_empty_title():
    assert title_contains_hangul("") is False
    assert title_contains_hangul(None) is False
