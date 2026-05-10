"""Deterministic Pulse mandate for surfaced topic-domain drift on tracked stories.

Some radar domains (Finance, Leadership) ingest adjacent non-technology content when clustering
misbinds. "Stories we're tracking" keeps Finance rows that show FS–tech / cyber / AI surfaces, and
Leadership rows where leadership is tied to enterprise technology, transformation, tooling, or tech
EXEC roles—not pure HR/strategy/general management stories without a tech cue."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models.article import Article

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Keyword banks (substring scan on lowercased text)
# -----------------------------------------------------------------------------

_ENTERPRISE_AND_CYBER_CORE = [
    # Core stack & delivery
    "saas",
    "software",
    "platform",
    "cloud",
    "api",
    "apis",
    "erp",
    "integration",
    "workflow",
    "kubernetes",
    "k8s",
    "datalake",
    "snowflake",
    "salesforce",
    "oracle",
    "sap",
    "cybersecurity",
    "ransomware",
    " malware",
    "breach",
    "phishing",
    "encryption",
    "ddos",
    "outage",
    "downtime",
    "vulnerability",
    "cve",
    "zero trust",
    "sso",
    "mfa",
    "iam ",
    " siem ",
    "soar",
]

_AI_SURFACE = [
    # AI / automation
    "machine learning",
    "artificial intelligence",
    "generative ai",
    "large language model",
    " llm",
]

_FINANCE_RAILS_AND_META_PRODUCT = [
    # Digital finance rails
    "fintech",
    "regtech",
    "cryptocurrency",
    "cryptocurrencies",
    "stablecoin",
    "blockchain",
    "bitcoin",
    "ethereum",
    "digital wallet",
    "mobile banking",
    "payment rail",
    "fednow",
    " usdc ",
    # Meta + money-movement (handled also by `_meta_fintech_context`)
    "stablecoin payouts",
    "meta rolls out stablecoin",
    "blockchain payouts",
]

_FINANCE_CONTEXT_RE = re.compile(
    r"(?i)\b("
    r"bank|banking|payments?|payment rail|treasury|lending|credit|insurance|fintech|regtech|"
    r"trading|portfolio|market data|risk system|fraud|accounting|erp|"
    r"venture|vc|startup|startups|funding|valuation|valuations|ipo|m&a|merger|acquisition|"
    r"investor|capital|stablecoin|crypto|cryptocurrency|blockchain|wallet|usdc"
    r")\b"
)

# Leadership: org-change / culture / strategy only counts when surfaced text ties to digitally
# enabled work — transformation, tooling, VP Eng / CIO-class roles, collaborative platforms,
# intelligent automation, governance of AI/digital systems—not retailer DEI or generic layoffs.
_LEADERSHIP_ORG_AND_WORK_TECH = [
    "digital transformation",
    "digital strategy",
    "technology strategy",
    "tech strategy",
    "digital workplace",
    "workplace technology",
    "remote collaboration",
    "hybrid workplace",
    "employee experience platform",
    "productivity platform",
    "collaboration platform",
    "unified communications",
    "microsoft 365",
    "microsoft teams",
    "google workspace",
    "workday",
    "servicenow",
    "successfactors",
    "hr tech",
    "hr technology",
    "hris",
    "people analytics",
    "talent management system",
    "learning management",
    " lms ",
    "learning experience platform",
    "lxp",
    "digital upskilling",
    "digital skills",
    "tech skills",
    "technology skills",
    "algorithmic management",
    "ai governance",
    "responsible ai",
    "data-driven leadership",
    "data driven leadership",
    "analytics platform",
    "business intelligence",
    " bi tool",
    " bi tools",
    "digital culture",
    "technology culture",
    "it culture",
    "digital change",
    "technology change",
    "process automation",
    "workflow automation",
    "intelligent automation",
    "robotic process",
    " rpa ",
    "low-code",
    "low code",
    "no-code",
    "no code",
    "engineering organization",
    "engineering org",
    "product engineering",
    "tech organization",
    "technology organization",
    "vp of engineering",
    "vice president of engineering",
    "chief information officer",
    "chief technology officer",
    "chief digital officer",
    "technology leadership",
    "tech leadership",
    "it leadership",
    "information technology",
    "information-technology",
]

TECH_NEEDLES_LEADERSHIP = _ENTERPRISE_AND_CYBER_CORE + _AI_SURFACE + _LEADERSHIP_ORG_AND_WORK_TECH

_GENERAL_PULSE_TECH_TERMS = [
    "technology",
    " tech ",
    "ai ",
    " ai",
    "agentic",
    "copilot",
    "data center",
    "datacenter",
    "semiconductor",
    "chip",
    "gpu",
    "npm",
    "package",
    "wordpress",
    "plugin",
    "internet outage",
    "network",
    "broadband",
    "openai",
    "aws",
    "google cloud",
    "microsoft",
]

# Max characters of article.body passed into the tracked-stories heuristic (cheap API payloads).
_SURFACE_CONTENT_CHARS = 14_000


def _meta_fintech_context(low: str) -> bool:
    """‘Meta’ the company + money-movement / digital-asset tech (not generic ‘metadata’)."""
    if not re.search(r"(?i)\bmeta\b", low):
        return False
    return bool(
        re.search(
            r"(?i)(stablecoin|blockchain|cryptocurrency|usdc|libra|payment|wallet|payout|digital currency|crypto)",
            low,
        )
    )


def _exec_tech_title_signal(low: str) -> bool:
    """CIO / CTO / CISO as leadership subject when not buried in unrelated prose (short-circuit aid)."""
    return bool(re.search(r"(?i)\b(cio|cto|ciso)\b", low))


def _collaboration_stack_vendor_signal(low: str) -> bool:
    """Slack / Zoom mentions (substring scan hits false positives e.g. ‘slacken’, ‘slack off’ quirks)."""
    return bool(re.search(r"(?i)\b(slack|zoom)\b", low))


def _text_from_fields(title: str, what_is_it: str | None, content_head: str) -> str:
    return "\n".join(
        s for s in (title or "", what_is_it or "", content_head or "") if (s or "").strip()
    )


def _any_needle(low: str, needles: list[str]) -> bool:
    for needle in needles:
        if needle in low:
            return True
    return False


def tracked_finance_article_has_pulse_tech_signals(
    title: str,
    what_is_it: str | None,
    content_head: str,
) -> bool:
    merged = _text_from_fields(title, what_is_it, content_head)
    if not merged.strip():
        return False
    low = merged.lower()

    if _any_needle(low, _FINANCE_RAILS_AND_META_PRODUCT):
        return True

    has_finance_context = bool(_FINANCE_CONTEXT_RE.search(low))
    has_generic_tech_context = _any_needle(low, _ENTERPRISE_AND_CYBER_CORE + _AI_SURFACE) or bool(
        re.search(r"(?i)\b(ai|automation|digital|tokeni[sz]ation|platforms?)\b", low)
    )
    if has_finance_context and has_generic_tech_context:
        return True

    if _meta_fintech_context(low):
        return True

    return False


def tracked_leadership_article_has_pulse_tech_signals(
    title: str,
    what_is_it: str | None,
    content_head: str,
) -> bool:
    """True when leadership content shows enterprise-technology, digital work, or tech-exec signal."""
    merged = _text_from_fields(title, what_is_it, content_head)
    if not merged.strip():
        return False
    low = merged.lower()

    if _any_needle(low, TECH_NEEDLES_LEADERSHIP):
        return True

    if _collaboration_stack_vendor_signal(low):
        return True

    if _exec_tech_title_signal(low):
        return True

    return False


def article_pulse_evidence_deep_blob(article: Article) -> str:
    """Full ingestion / reclassification context: raw content plus summaries, tags, and subdomain cues."""
    tags = getattr(article, "tags", None) or []
    tag_text = " ".join(str(t) for t in tags if str(t).strip())
    return "\n".join(
        part
        for part in (
            article.content or "",
            article.what_is_it or "",
            article.why_it_matters or "",
            getattr(article, "subdomain", "") or "",
            tag_text,
        )
        if part.strip()
    )


def article_pulse_evidence_surface_content(article: Article) -> str:
    """Truncated article text for lightweight public-tracked checks."""
    if not getattr(article, "content", None) or not str(article.content).strip():
        return ""
    return " ".join(str(article.content).split())[:_SURFACE_CONTENT_CHARS]


def article_passes_pulse_tech_deep(article: Article, domain: str | None) -> bool:
    """
    Applies deterministic Finance / Leadership cues used at ingest and legacy cleanup.

    Uses rich evidence (summaries, tags, subdomain, full-ish content—not truncated like the API).
    Domains outside Finance / Leadership always pass.
    """
    dom = (domain or "").strip()
    if dom not in ("Finance", "Leadership"):
        return True

    title = getattr(article, "title", None) or ""
    what = getattr(article, "what_is_it", None)
    blob = article_pulse_evidence_deep_blob(article)
    if dom == "Finance":
        return tracked_finance_article_has_pulse_tech_signals(title, what, blob)
    return tracked_leadership_article_has_pulse_tech_signals(title, what, blob)


def article_has_general_pulse_tech_signal(article: Article) -> bool:
    """Broad stop-at-research gate for generic non-tech stories before topic creation."""
    title = getattr(article, "title", None) or ""
    what = getattr(article, "what_is_it", None)
    blob = article_pulse_evidence_deep_blob(article)
    return text_has_general_pulse_tech_signal(_text_from_fields(title, what, blob))


def text_has_general_pulse_tech_signal(text: str) -> bool:
    """Same broad stop-at-research check as `article_has_general_pulse_tech_signal` but on raw text.

    Used by the gate node so we can override an LLM that says "relevant" for an article whose
    content has zero substring evidence of Pulse-tech surfaces (politics, lifestyle, raw milk, etc.).
    """
    merged = (text or "").lower()
    if not merged.strip():
        return False
    if re.search(
        r"(?i)\b(not|nothing|without)\b.{0,80}\b(technology|tech|software|systems?|automation|ai)\b",
        merged,
    ):
        return False
    return _any_needle(
        merged,
        _ENTERPRISE_AND_CYBER_CORE
        + _AI_SURFACE
        + _FINANCE_RAILS_AND_META_PRODUCT
        + _LEADERSHIP_ORG_AND_WORK_TECH
        + _GENERAL_PULSE_TECH_TERMS,
    )


# -----------------------------------------------------------------------------
# Deterministic Pulse-domain inference
#
# Used as a code-side rescue when the LLM classifier returns "Other" or a
# "<domain>: Review Needed" topic name despite obvious AI / Security / Cloud /
# Finance / Leadership cues in the article. Keeps clear-cut stories out of the
# manual review queue.
# -----------------------------------------------------------------------------


_AI_DOMAIN_RE = re.compile(
    r"(?i)\b("
    r"aiops|ai\s+ops|chatbots?|agentic|generative\s+ai|gen\s*ai|"
    r"large\s+language\s+models?|llms?|"
    r"machine\s+learning|deep\s+learning|neural\s+networks?|"
    r"openai|anthropic|claude|chatgpt|gpt[\-\s]?\d?|gemini|llama|mistral|perplexity|"
    r"copilot|ai\s+agents?|ai[\-\s]powered|ai[\-\s]driven|ai[\-\s]first|ai[\-\s]native|"
    r"foundation\s+models?|model\s+cards?|reinforcement\s+learning|"
    r"transformer\s+models?|"
    r"\bai\b"
    r")\b"
)

_SECURITY_DOMAIN_RE = re.compile(
    r"(?i)\b("
    r"cve[\-\s]?\d{2,}|ransomware|phishing|zero[\-\s]day|0[\-\s]day|"
    r"data\s+breach|breached?|credential\s+theft|"
    r"ddos|malware|exploit(?:ed|s|ing)?|patch\s+tuesday|"
    r"vulnerabilit(?:y|ies)|security\s+flaws?|cybersecurity|infosec|"
    r"npm\s+packages?\s+compromised|supply[\-\s]chain\s+attacks?|"
    r"siem|soar|edr|xdr|ciso"
    r")\b"
)

_CLOUD_DOMAIN_RE = re.compile(
    r"(?i)\b("
    r"aws|amazon\s+web\s+services|azure|google\s+cloud|gcp|"
    r"kubernetes|k8s|snowflake|databricks|data[\-\s]?center|"
    r"saas|paas|iaas|serverless|container\s+orchestration"
    r")\b"
)

_FINANCE_DOMAIN_RE = re.compile(
    r"(?i)\b("
    r"fintech|regtech|stablecoins?|blockchain[\-\s]payouts?|"
    r"core\s+banking|payment\s+rails?|fednow|open\s+banking|"
    r"trading\s+platform|market\s+data\s+system|settlement\s+systems?"
    r")\b"
)

_LEADERSHIP_DOMAIN_RE = re.compile(
    r"(?i)\b("
    r"cio|cto|ciso|"
    r"chief\s+information\s+officer|"
    r"chief\s+technology\s+officer|"
    r"chief\s+digital\s+officer|"
    r"digital\s+transformation|digital\s+strategy"
    r")\b"
)


def infer_pulse_domain(text: str) -> str | None:
    """Best-effort deterministic domain label from raw text.

    Order matters: AI > Security > Cloud > Finance > Leadership. Returns ``None`` if no
    confident substring evidence is found, so callers fall back to LLM/curator paths.
    """
    if not text:
        return None
    if _AI_DOMAIN_RE.search(text):
        return "AI"
    if _SECURITY_DOMAIN_RE.search(text):
        return "Security"
    if _CLOUD_DOMAIN_RE.search(text):
        return "Cloud"
    if _FINANCE_DOMAIN_RE.search(text):
        return "Finance"
    if _LEADERSHIP_DOMAIN_RE.search(text):
        return "Leadership"
    return None


def article_qualifies_pulse_tracked_surface(article: Article) -> bool:
    """Finance and Leadership rows must embed a Pulse tech cue; other domains unchanged.

    Uses truncated body text plus title/teaser — lighter than ingest-time `article_pulse_evidence_deep_blob`.
    """
    topic = getattr(article, "topic", None)
    dom = (topic.domain.strip() if topic and topic.domain else "") or ""
    if dom not in ("Finance", "Leadership"):
        return True

    title = getattr(article, "title", None) or ""
    what = getattr(article, "what_is_it", None)
    blob = article_pulse_evidence_surface_content(article)

    if dom == "Finance":
        ok = tracked_finance_article_has_pulse_tech_signals(title, what, blob)
        if not ok:
            logger.debug(
                "Tracked surface skips Finance article id=%s — no Pulse tech substring in surfaced fields",
                article.id,
            )
        return ok

    ok = tracked_leadership_article_has_pulse_tech_signals(title, what, blob)
    if not ok:
        logger.debug(
            "Tracked surface skips Leadership article id=%s — no Pulse tech substring in surfaced fields",
            article.id,
        )
    return ok
