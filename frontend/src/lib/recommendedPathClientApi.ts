import { apiOriginForBrowser } from "./api";
import type {
  RecommendedPathIntake,
  RecommendedPathPayload,
  RecommendedWatchStoryPayload,
} from "./recommendedPathTypes";

export type StreamRecommendedPathHandlers = {
  onShell: (payload: RecommendedPathPayload) => void;
  onAi: (payload: RecommendedPathPayload) => void;
  onDone: () => void;
  onError: () => void;
  /** When aborted, the stream stops without calling `onError` (caller cancelled). */
  signal?: AbortSignal;
};

/** Returns `null` on non-OK HTTP, JSON parse failure, or thrown fetch errors (network, aborted, etc.). */
async function fetchRecommendedPathPayload(
  url: string,
  signal?: AbortSignal,
): Promise<RecommendedPathPayload | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return null;
    return (await res.json()) as RecommendedPathPayload;
  } catch {
    return null;
  }
}

function buildRecommendedPathUrl(intake: RecommendedPathIntake, skipAi: boolean): string {
  const u = new URL(`${apiOriginForBrowser()}/api/recommended-path`);
  const keys = ["region", "industry", "role", "issue", "stage"] as const;
  for (const k of keys) {
    u.searchParams.set(k, (intake[k] ?? "").trim());
  }
  u.searchParams.set("defer_articles", "true");
  if (skipAi) u.searchParams.set("skip_ai", "true");
  return u.toString();
}

function buildRecommendedPathWatchStoriesUrl(intake: RecommendedPathIntake): string {
  const u = new URL(`${apiOriginForBrowser()}/api/recommended-path/watch-stories`);
  const keys = ["region", "industry", "role", "issue", "stage"] as const;
  for (const k of keys) {
    u.searchParams.set(k, (intake[k] ?? "").trim());
  }
  return u.toString();
}

function buildRecommendedPathStreamUrl(intake: RecommendedPathIntake): string {
  const u = new URL(`${apiOriginForBrowser()}/api/recommended-path/stream`);
  const keys = ["region", "industry", "role", "issue", "stage"] as const;
  for (const k of keys) {
    u.searchParams.set(k, (intake[k] ?? "").trim());
  }
  return u.toString();
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException
    ? e.name === "AbortError"
    : e instanceof Error && e.name === "AbortError";
}

/**
 * Consumes `GET /api/recommended-path/stream` as Server-Sent Events (`event` + `data` lines, blank line between records).
 * Buffers partial lines across chunks so records can be split arbitrarily in the byte stream.
 */
export async function streamRecommendedPath(
  intake: RecommendedPathIntake,
  handlers: StreamRecommendedPathHandlers,
): Promise<void> {
  const { onShell, onAi, onDone, onError, signal } = handlers;
  const url = buildRecommendedPathStreamUrl(intake);

  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok || !res.body) {
      onError();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let lineBuf = "";
    let eventName = "";
    const dataLines: string[] = [];

    const flushRecord = (): void => {
      if (dataLines.length === 0 && !eventName) return;
      const raw = dataLines.join("\n");
      dataLines.length = 0;
      const ev = eventName || "message";
      eventName = "";

      if (ev === "done") {
        onDone();
        return;
      }

      if (!raw) {
        onError();
        return;
      }

      let payload: RecommendedPathPayload;
      try {
        payload = JSON.parse(raw) as RecommendedPathPayload;
      } catch {
        onError();
        return;
      }
      if (ev === "shell") onShell(payload);
      else if (ev === "ai") onAi(payload);
    };

    const stopAfterAbortIfNeeded = async (): Promise<boolean> => {
      if (!signal?.aborted) return false;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return true;
    };

    let streamDone = false;
    while (!streamDone) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (e) {
        if (signal?.aborted || isAbortError(e)) return;
        onError();
        return;
      }
      const { done, value } = readResult;
      if (done) {
        streamDone = true;
        break;
      }

      lineBuf += decoder.decode(value, { stream: true });
      for (;;) {
        const nl = lineBuf.indexOf("\n");
        if (nl < 0) break;
        let line = lineBuf.slice(0, nl);
        lineBuf = lineBuf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          flushRecord();
          if (await stopAfterAbortIfNeeded()) return;
          continue;
        }
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
      }
    }

    if (lineBuf.length > 0) {
      let line = lineBuf;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line !== "") {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
      }
    }
    flushRecord();
  } catch (e) {
    if (signal?.aborted || isAbortError(e)) return;
    onError();
  }
}

/**
 * Primary: AI-assisted `skip_ai=false`. On `null`, retries once with deterministic `skip_ai=true`—same payload shape,
 * typically after provider issues or HTTP failures. Caller sees `null` only if **both** requests fail or return unusable bodies.
 *
 * Pulse **watch story rows are deferred**: main payload includes `watch_stories: []` until ``fetchRecommendedPathWatchStories``.
 */
export async function fetchRecommendedPathProgressive(
  intake: RecommendedPathIntake,
  signal?: AbortSignal,
): Promise<RecommendedPathPayload | null> {
  const primary = await fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, false), signal);
  if (signal?.aborted) return null;
  if (primary !== null) return primary;
  return fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, true), signal);
}

export type RecommendedPathProgressiveHandlers = {
  /** Fast deterministic payload (`skip_ai=true`) — used to paint immediately. */
  onShell: (payload: RecommendedPathPayload) => void;
  /** AI-assisted payload (`skip_ai=false`) — replaces the shell when ready. May be skipped if shell already failed and AI also failed. */
  onAi?: (payload: RecommendedPathPayload) => void;
  /** Called once both requests have settled (regardless of success). */
  onSettled?: () => void;
  /** Called when **both** the shell and AI requests fail to return usable bodies. */
  onError?: () => void;
};

/**
 * Two parallel requests against the existing endpoints, both with `defer_articles=true`:
 *   1. `skip_ai=true` — deterministic, sub-second, paints immediately via ``onShell``.
 *   2. `skip_ai=false` — LLM-assisted, slower; calls ``onAi`` when ready so the body can upgrade the copy in place.
 *
 * If the LLM call beats the deterministic call the latter is silently ignored.
 */
export function fetchRecommendedPathTwoStage(
  intake: RecommendedPathIntake,
  handlers: RecommendedPathProgressiveHandlers,
  signal?: AbortSignal,
): { promise: Promise<void> } {
  const { onShell, onAi, onSettled, onError } = handlers;
  let shellDelivered = false;
  let aiDelivered = false;

  const shellPromise = (async () => {
    const payload = await fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, true), signal);
    if (signal?.aborted) return false;
    if (payload === null || aiDelivered) return false;
    shellDelivered = true;
    onShell(payload);
    return true;
  })();

  const aiPromise = (async () => {
    const payload = await fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, false), signal);
    if (signal?.aborted) return false;
    if (payload === null) return false;
    aiDelivered = true;
    if (onAi) onAi(payload);
    else if (!shellDelivered) onShell(payload);
    return true;
  })();

  const promise = Promise.allSettled([shellPromise, aiPromise]).then((results) => {
    if (signal?.aborted) return;
    const anyDelivered = results.some((r) => r.status === "fulfilled" && r.value === true);
    if (!anyDelivered && onError) onError();
    if (onSettled) onSettled();
  });

  return { promise };
}

/** Hydrates `watch_stories` using the same intake facets (after deferred main payload). */
export async function fetchRecommendedPathWatchStories(
  intake: RecommendedPathIntake,
  signal?: AbortSignal,
): Promise<RecommendedWatchStoryPayload[] | null> {
  try {
    const res = await fetch(buildRecommendedPathWatchStoriesUrl(intake), { cache: "no-store", signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { watch_stories?: unknown };
    return Array.isArray(body.watch_stories) ? (body.watch_stories as RecommendedWatchStoryPayload[]) : null;
  } catch {
    return null;
  }
}
