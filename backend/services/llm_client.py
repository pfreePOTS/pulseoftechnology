"""
LLM completions: DeepSeek primary, then Anthropic Claude, then OpenAI chat.

If ``DEEPSEEK_API_KEY`` is set, calls go to DeepSeek first. On failure:
1. Anthropic Claude (when ``ANTHROPIC_API_KEY`` is set)
2. OpenAI chat (when ``OPENAI_API_KEY`` is set) — last-resort backup model

Billing failures (402 / insufficient credit) skip same-provider retries and open a
short circuit so the next articles go straight to the backup.
"""

from __future__ import annotations

import logging
import time
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

    latency_ms: int
    """Wall time for the underlying provider round-trip (milliseconds)."""

    total_tokens: int | None = None
    """Provider-reported tokens when available (input+output summed for Anthropic)."""


def _deepseek_configured() -> bool:
    return bool((settings.deepseek_api_key or "").strip())


def _anthropic_configured() -> bool:
    return bool((settings.anthropic_api_key or "").strip())


def _openai_chat_configured() -> bool:
    return bool((settings.openai_api_key or "").strip())


def is_llm_configured() -> bool:
    """At least one chat provider credential is present."""
    return _deepseek_configured() or _anthropic_configured() or _openai_chat_configured()


_DEEPSEEK_BILLING_COOLDOWN_S = 15 * 60
_deepseek_circuit_until = 0.0


def reset_provider_circuits() -> None:
    """Test helper — clear DeepSeek billing skip window."""
    global _deepseek_circuit_until
    _deepseek_circuit_until = 0.0


def _is_billing_error(exc: BaseException) -> bool:
    code = getattr(exc, "status_code", None)
    if code == 402:
        return True
    msg = str(exc).lower()
    return (
        "insufficient balance" in msg
        or "credit balance is too low" in msg
        or "credit balance too low" in msg
    )


def _trip_deepseek_circuit() -> None:
    global _deepseek_circuit_until
    _deepseek_circuit_until = time.monotonic() + _DEEPSEEK_BILLING_COOLDOWN_S
    logger.warning(
        "DeepSeek billing failure — skipping DeepSeek for %ss and using backup models",
        _DEEPSEEK_BILLING_COOLDOWN_S,
    )


def _deepseek_circuit_open() -> bool:
    return time.monotonic() < _deepseek_circuit_until


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
_openai_chat: OpenAI | None = None
_anthropic: anthropic.Anthropic | None = None


def _get_openai_client() -> OpenAI:
    global _oai
    if _oai is None:
        if not _deepseek_configured():
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")
        base = (settings.deepseek_base_url or "https://api.deepseek.com").rstrip("/")
        _oai = OpenAI(api_key=settings.deepseek_api_key, base_url=base)
    return _oai


def _get_openai_chat_client() -> OpenAI:
    global _openai_chat
    if _openai_chat is None:
        if not _openai_chat_configured():
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _openai_chat = OpenAI(api_key=settings.openai_api_key)
    return _openai_chat


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


def _deepseek_usage_total_tokens(resp) -> int | None:
    usage = getattr(resp, "usage", None)
    if usage is None:
        return None
    t = getattr(usage, "total_tokens", None)
    if isinstance(t, int):
        return t
    return None


def _anthropic_usage_total_tokens(response) -> int | None:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    inp = getattr(usage, "input_tokens", None)
    outp = getattr(usage, "output_tokens", None)
    if inp is None and outp is None:
        return None
    ia = inp if isinstance(inp, int) else 0
    oa = outp if isinstance(outp, int) else 0
    return ia + oa


def _complete_deepseek(
    requested_model: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
    json_response: bool = False,
    disable_thinking: bool = False,
) -> tuple[str, int | None]:
    model = resolved_model(requested_model)
    client = _get_openai_client()
    kwargs: dict = dict(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
    )
    if disable_thinking:
        # DeepSeek V4 models reason by default and the reasoning tokens count
        # against max_tokens — a latency-sensitive call can burn most of its
        # budget thinking and truncate the visible JSON mid-string.
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    if json_response:
        # OpenAI-compatible JSON mode — some DeepSeek builds return null/blank content in this mode.
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(**kwargs)
    except OpenAIError as e:
        if json_response and not _is_billing_error(e):
            logger.info(
                "DeepSeek request with json_object failed (%s); retrying without JSON mode.", e
            )
            kwargs.pop("response_format", None)
            resp = client.chat.completions.create(**kwargs)
        else:
            raise

    tokens = _deepseek_usage_total_tokens(resp)
    ch = getattr(resp.choices[0].message, "content", None)
    raw_len = len(str(ch)) if ch is not None else 0
    text = ""
    if ch is not None:
        text = _strip_code_fences(str(ch))

    # Retry once without JSON mode when the completion body is unusable — same workaround as OpenAIError path.
    if json_response and (ch is None or not text.strip()):
        if ch is None:
            logger.warning(
                "DeepSeek returned null message.content with response_format=json_object (model=%s); "
                "retrying without JSON mode.",
                model,
            )
        else:
            logger.warning(
                "DeepSeek returned empty text after strip/fences with response_format=json_object "
                "(model=%s; raw_len=%s); retrying without JSON mode.",
                model,
                raw_len,
            )
        kwargs_retry = dict(kwargs)
        kwargs_retry.pop("response_format", None)
        resp2 = client.chat.completions.create(**kwargs_retry)
        tokens = _deepseek_usage_total_tokens(resp2) or tokens
        ch2 = getattr(resp2.choices[0].message, "content", None)
        if ch2 is not None:
            text = _strip_code_fences(str(ch2))
    return text, tokens


def _openai_chat_model() -> str:
    return (settings.openai_chat_model or "").strip() or "gpt-4o-mini"


def _complete_openai_chat(
    requested_model: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
    json_response: bool = False,
) -> tuple[str, str, int | None]:
    model = _openai_chat_model()
    _ = requested_model
    client = _get_openai_chat_client()
    kwargs: dict = dict(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
    )
    if json_response:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(**kwargs)
    except OpenAIError as e:
        if json_response and not _is_billing_error(e):
            kwargs.pop("response_format", None)
            resp = client.chat.completions.create(**kwargs)
        else:
            raise
    tokens = _deepseek_usage_total_tokens(resp)
    ch = getattr(resp.choices[0].message, "content", None)
    text = _strip_code_fences(str(ch)) if ch is not None else ""
    return text, model, tokens


def _complete_anthropic(
    requested_model: str, *, system: str, user: str, max_tokens: int
) -> tuple[str, str, int | None]:
    mid = _anthropic_equivalent_model(requested_model)
    raw = _get_anthropic_client().messages.create(
        model=mid,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    tokens = _anthropic_usage_total_tokens(raw)
    text = _strip_code_fences(raw.content[0].text)
    return text, mid, tokens


def chat_completion_result(
    requested_model: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
    json_response: bool = False,
    disable_thinking: bool = False,
) -> ChatCompletionResult:
    """
    Run chat completion: DeepSeek first when configured; Anthropic on missing key, after DeepSeek
    error, or as sole provider.

    ``disable_thinking`` turns off DeepSeek reasoning for latency-sensitive calls
    (Anthropic fallback ignores it — those models don't think by default here).
    """
    if not is_llm_configured():
        raise RuntimeError("Configure DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, and/or OPENAI_API_KEY")

    started = time.perf_counter()
    errors: list[str] = []

    if _deepseek_configured() and not _deepseek_circuit_open():
        try:
            text, tok = _complete_deepseek(
                requested_model,
                system=system,
                user=user,
                max_tokens=max_tokens,
                json_response=json_response,
                disable_thinking=disable_thinking,
            )
            mid = resolved_model(requested_model)
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ChatCompletionResult(
                text=text, model_id=mid, latency_ms=latency_ms, total_tokens=tok
            )
        except OpenAIError as e:
            logger.warning("DeepSeek request failed (%s)", e)
            errors.append(f"DeepSeek: {e}")
            if _is_billing_error(e):
                _trip_deepseek_circuit()
    elif _deepseek_configured() and _deepseek_circuit_open():
        logger.info("DeepSeek circuit open — using backup model")

    if _anthropic_configured():
        if _deepseek_configured():
            logger.info(
                "Falling back to Anthropic Claude (requested_route=%r)", requested_model or ""
            )
        try:
            text, mid, tok = _complete_anthropic(
                requested_model, system=system, user=user, max_tokens=max_tokens
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ChatCompletionResult(
                text=text, model_id=mid, latency_ms=latency_ms, total_tokens=tok
            )
        except anthropic.APIError as ae:
            logger.warning("Anthropic fallback failed (%s)", ae)
            errors.append(f"Anthropic: {ae}")

    if _openai_chat_configured():
        logger.info(
            "Falling back to OpenAI chat model %s (requested_route=%r)",
            _openai_chat_model(),
            requested_model or "",
        )
        try:
            text, mid, tok = _complete_openai_chat(
                requested_model,
                system=system,
                user=user,
                max_tokens=max_tokens,
                json_response=json_response,
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            return ChatCompletionResult(
                text=text, model_id=mid, latency_ms=latency_ms, total_tokens=tok
            )
        except OpenAIError as oe:
            logger.warning("OpenAI chat fallback failed (%s)", oe)
            errors.append(f"OpenAI: {oe}")

    if errors:
        raise LLMAPIError("; ".join(errors))
    raise RuntimeError("No LLM credentials for chat completion")


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
