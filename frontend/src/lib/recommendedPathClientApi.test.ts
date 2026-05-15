import { afterEach, describe, expect, it, vi } from "vitest";

import { streamRecommendedPath } from "./recommendedPathClientApi";
import type { RecommendedPathIntake, RecommendedPathPayload } from "./recommendedPathTypes";

const intake: RecommendedPathIntake = {
  region: "",
  industry: "Energy",
  role: "COO",
  issue: "",
  stage: "",
};

function payloadFor(headline: string): RecommendedPathPayload {
  return {
    headline,
    synthesis: "P1.\n\nP2.",
    synthesis_html: "<p>P1.</p><p>P2.</p>",
    synthesis_cards: [{ title: "Card", bullets: ["a", "b"] }],
    experience_items: [{ title: "Exp", description: "Desc", icon: "assessment" }],
    topics: [],
    content_items: [],
    watch_brief: "",
    watch_posture: "",
    watch_stories: [],
  };
}

/** Build a `Response` whose body is an SSE stream. Each `events` entry is one record. */
function sseResponse(events: { event: string; data: unknown }[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        const body = typeof e.data === "string" ? e.data : JSON.stringify(e.data);
        // Emit each record as `event: …\ndata: …\n\n` per SSE spec; multi-line data uses
        // multiple `data:` lines but our tests use single-line JSON so one suffices.
        controller.enqueue(enc.encode(`event: ${e.event}\ndata: ${body}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("streamRecommendedPath", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("invokes onShell then onAi then onDone for a cold stream", async () => {
    const shell = payloadFor("Shell H");
    const ai = payloadFor("AI H");
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        { event: "shell", data: shell },
        { event: "ai", data: ai },
        { event: "done", data: {} },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onShell = vi.fn();
    const onAi = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamRecommendedPath(intake, { onShell, onAi, onDone, onError });

    expect(onShell).toHaveBeenCalledTimes(1);
    expect(onShell.mock.calls[0]![0]).toEqual(shell);
    expect(onAi).toHaveBeenCalledTimes(1);
    expect(onAi.mock.calls[0]![0]).toEqual(ai);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/recommended-path/stream");
    expect(url).toContain("industry=Energy");
    expect(url).toContain("role=COO");
    expect(init.cache).toBe("no-store");
  });

  it("invokes only onAi+onDone when the server short-circuits on a cache hit", async () => {
    const ai = payloadFor("Cached H");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          { event: "ai", data: ai },
          { event: "done", data: {} },
        ]),
      ),
    );

    const onShell = vi.fn();
    const onAi = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamRecommendedPath(intake, { onShell, onAi, onDone, onError });

    expect(onShell).not.toHaveBeenCalled();
    expect(onAi).toHaveBeenCalledTimes(1);
    expect(onAi.mock.calls[0]![0]).toEqual(ai);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onError on non-OK HTTP without firing shell/ai callbacks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 })),
    );

    const onShell = vi.fn();
    const onAi = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamRecommendedPath(intake, { onShell, onAi, onDone, onError });

    expect(onShell).not.toHaveBeenCalled();
    expect(onAi).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("calls onError when fetch rejects (network failure / abort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    const onError = vi.fn();
    await streamRecommendedPath(intake, {
      onShell: vi.fn(),
      onAi: vi.fn(),
      onDone: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("tolerates SSE records split across multiple chunks", async () => {
    // SSE protocol does not guarantee a record arrives in one chunk; the parser must buffer
    // partial lines until it sees the terminating blank line. This caused real production
    // bugs in early implementations of similar parsers.
    const shell = payloadFor("Shell H");
    const ai = payloadFor("AI H");
    const enc = new TextEncoder();
    const fullText =
      `event: shell\ndata: ${JSON.stringify(shell)}\n\n` +
      `event: ai\ndata: ${JSON.stringify(ai)}\n\n` +
      `event: done\ndata: {}\n\n`;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Hand-pick split points that bisect a `data:` line and a record terminator.
        const cuts = [Math.floor(fullText.length / 3), Math.floor((fullText.length * 2) / 3)];
        let prev = 0;
        for (const c of cuts) {
          controller.enqueue(enc.encode(fullText.slice(prev, c)));
          prev = c;
        }
        controller.enqueue(enc.encode(fullText.slice(prev)));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const onShell = vi.fn();
    const onAi = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    await streamRecommendedPath(intake, { onShell, onAi, onDone, onError });

    expect(onShell).toHaveBeenCalledWith(shell);
    expect(onAi).toHaveBeenCalledWith(ai);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("stops processing after AbortSignal is raised mid-stream", async () => {
    // The component effect that opens the stream MUST be cancellable on intake change /
    // unmount, otherwise a stale request could overwrite fresh intake data on resolution.
    const shell = payloadFor("Shell H");
    const enc = new TextEncoder();
    const controller = new AbortController();

    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        streamController.enqueue(enc.encode(`event: shell\ndata: ${JSON.stringify(shell)}\n\n`));
        // Keep stream open; the AbortSignal must short-circuit the read loop.
        await new Promise((r) => setTimeout(r, 50));
        streamController.enqueue(enc.encode(`event: ai\ndata: {}\n\n`));
        streamController.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit | undefined) => {
        // Wire the user's abort signal through to the simulated stream so the helper
        // experiences the same cancellation semantics it would in production.
        init?.signal?.addEventListener("abort", () => {
          /* readers will throw AbortError on next pull */
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        );
      }),
    );

    const onShell = vi.fn(() => {
      controller.abort();
    });
    const onAi = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamRecommendedPath(intake, {
      onShell,
      onAi,
      onDone,
      onError,
      signal: controller.signal,
    });

    expect(onShell).toHaveBeenCalledTimes(1);
    expect(onAi).not.toHaveBeenCalled();
  });
});
