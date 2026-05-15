from ..services.article_language import contains_non_latin_script, title_contains_hangul


def test_hangul_detected_in_title():
    assert title_contains_hangul("기업 52% 생성형 AI") is True


def test_ascii_title_not_hangul():
    assert title_contains_hangul("How to Evaluate AI SOC Agents") is False


def test_empty_title():
    assert title_contains_hangul("") is False
    assert title_contains_hangul(None) is False


def test_contains_non_latin_script_detects_cjk_cyrillic_arabic_hangul():
    assert contains_non_latin_script("中国 AI 法规更新") is True
    assert contains_non_latin_script("Российские банки и ИИ") is True
    assert contains_non_latin_script("الذكاء الاصطناعي") is True
    assert contains_non_latin_script("기업 52% 생성형 AI") is True


def test_contains_non_latin_script_passes_english_with_punctuation_and_acronyms():
    assert contains_non_latin_script("Cisco & Palo Alto Networks: SASE in 2026") is False
    assert contains_non_latin_script("AI agents reshape SOC ops — Q4 outlook") is False
    assert contains_non_latin_script("") is False
    assert contains_non_latin_script(None) is False
