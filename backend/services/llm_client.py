"""
LLM completions: **DeepSeek** (OpenAI-compatible) as primary; **Anthropic Claude** optional fallback.

If ``DEEPSEEK_API_KEY`` is set, calls go to DeepSeek first. On failure, if ``ANTHROPIC_API_KEY`` is set,
requests are retried against Claude using a tier derived from the requested model label.

If only ``ANTHROPIC_API_KEY`` is set (no DeepSeek key), Anthropic is used directly.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import anthropic
from openai import OpenAI, OpenAIError

from ..config import settings

logger = logging.getLogger(__name__)


class LLMAPIError(Exception):
    """Raised when the active provider fails; pipeline code may treat this as retry-worthy."""


@dataclass(frozen=True)
class ChatCompletionResult:
    text: str
    """Visible text after stripping code fences."""

    model_id: str
    """Model identifier actually invoked (DeepSeek id or Claude id)."""


def _deepseek_configured() -> bool:
    return bool((settings.deepseek_api_key or "").strip())


def _anthropic_configured() -> bool:
    return bool((settings.anthropic_api_key or "").strip())


def is_llm_configured() -> bool:
    """At least one of DeepSeek or Anthropic credentials present."""
    return _deepseek_configured() or _anthropic_configured()


# Official V4 IDs + legacy aliases (until retirement). See DeepSeek API model list.
_KNOWN_DEEPSEEK = frozenset(
    {
        "deepseek-v4-pro",
        "deepseek-v4-flash",
        "deepseek-chat",
        "deepseek-reasoner",
    }
)


def resolved_model(requested_model: str | None = None) -> str:
    """Resolve DeepSeek model id — known labels win; otherwise ``DEEPSEEK_MODEL`` / default."""
    req = (requested_model or "").strip()
    if req in _KNOWN_DEEPSEEK:
        return req
    fb = (settings.deepseek_model or "").strip()
    if fb:
        return fb
    return "deepseek-v4-pro"


_oai: OpenAI | None = None
_anthropic: anthropic.Anthropic | None = None


def _get_openai_client() -> OpenAI:
    global _oai
    if _oai is None:
        if not _deepseek_configured():
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        base = (settings.deepseek_base_url or "https://api.deepseek.com").rstrip("/")
        _oai = OpenAI(api_key=settings.deepseek_api_key, base_url=base)
    return _oai


def _get_anthropic_client() -> anthropic.Anthropic:
    global _anthropic
    if _anthropic is None:
        if not _anthropic_configured():
            raise RuntimeError("ANTHROPIC_API_KEY is not configured")
        _anthropic = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0].strip()
    return text


def _anthropic_equivalent_model(requested_model: str) -> str:
    """Map arbitrary pipeline / dropdown labels onto Haiku vs Sonnet for fallback."""
    req = (requested_model or "").strip()
    if req.startswith("claude-"):
        return req

    rm = req.lower()
    hk = settings.anthropic_haiku_model.strip()
    sn = settings.anthropic_sonnet_model.strip()

    if rm == hk.lower() or hk.lower() in rm:
        return hk
    if rm == sn.lower() or sn.lower() in rm or "sonnet" in rm:
        return sn

    if any(x in rm for x in ("flash", "chat", "haiku")):
        return hk
    if any(x in rm for x in ("reasoner", "pro", "v4-pro", "deepseek-v4-pro")):
        return sn

    return sn


def _complete_deepseek(requested_model: str, *, system: str, user: str, max_tokens: int) -> str:
    model = resolved_model(requested_model)
    resp = _get_openai_client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
    )
    ch = resp.choices[0].message.content
    if ch is None:
        return ""
    return _strip_code_fences(str(ch))


def _complete_anthropic(
    requested_model: str, *, system: str, user: str, max_tokens: int
) -> tuple[str, str]:
    mid = _anthropic_equivalent_model(requested_model)
    raw = _get_anthropic_client().messages.create(
        model=mid,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = _strip_code_fences(raw.content[0].text)
    return text, mid


def chat_completion_result(
    requested_model: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
) -> ChatCompletionResult:
    """
    Run chat completion: DeepSeek first when configured; Anthropic on missing key, after DeepSeek
    error, or as sole provider.
    """
    if not is_llm_configured():
        raise RuntimeError("Configure DEEPSEEK_API_KEY and/or ANTHROPIC_API_KEY")

    if _deepseek_configured():
        try:
            text = _complete_deepseek(
                requested_model, system=system, user=user, max_tokens=max_tokens
            )
            return ChatCompletionResult(text=text, model_id=resolved_model(requested_model))
        except OpenAIError as e:
            logger.warning("DeepSeek request failed (%s)", e)
            if not _anthropic_configured():
                raise LLMAPIError(str(e)) from e
            logger.info(
                "Falling back to Anthropic Claude (requested_route=%r)", requested_model or ""
            )
            try:
                text, mid = _complete_anthropic(
                    requested_model, system=system, user=user, max_tokens=max_tokens
                )
                return ChatCompletionResult(text=text, model_id=mid)
            except anthropic.APIError as ae:
                raise LLMAPIError(f"DeepSeek failed; Anthropic fallback failed: {ae}") from ae

    if not _anthropic_configured():
        raise RuntimeError("No Anthropic credentials for LLM invocation")

    try:
        text, mid = _complete_anthropic(
            requested_model, system=system, user=user, max_tokens=max_tokens
        )
        return ChatCompletionResult(text=text, model_id=mid)
    except anthropic.APIError as e:
        raise LLMAPIError(str(e)) from e


def chat_completion(
    requested_model: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
) -> str:
    return chat_completion_result(
        requested_model, system=system, user=user, max_tokens=max_tokens
    ).text
