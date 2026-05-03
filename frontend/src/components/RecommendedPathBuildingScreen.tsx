/**
 * Full-page / overlay messaging while `/recommended-path` waits for one complete API
 * response. No phased “fake progress” checklist — turnaround is purely server-bound.
 */

type Props = {
  /** Omit full-viewport backdrop when rendered inside an overlay shell (progressive loader). */
  embedded?: boolean;
};

export default function RecommendedPathBuildingScreen({ embedded = false }: Props) {
  return (
    <div
      className={
        embedded
          ? "flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center px-6 py-16"
          : "flex min-h-screen flex-col items-center justify-center bg-dark-bg px-6 py-16"
      }
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">
        Waiting for PulseOne servers. When the assisted response is unavailable or incomplete, a second fully formed
        briefing is requested automatically before any error state appears.
      </span>

      <div className="relative mb-10 flex h-32 w-32 items-center justify-center">
        <div className="loading-pulse-ring absolute inset-0 rounded-full bg-pulse-teal/35" />
        <div className="loading-pulse-ring-2 absolute inset-0 rounded-full bg-pulse-teal/35" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-pulse-teal shadow-[0_0_28px_rgba(1,158,124,0.55)]">
          <div className="loading-pulse-dot h-3 w-3 rounded-full bg-white" />
        </div>
      </div>

      <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
        Custom Path
      </span>
      <h1 className="mb-3 text-center font-sans text-[clamp(1.625rem,3.5vw,2.25rem)] leading-tight font-extrabold text-white">
        Building your specific solution.
      </h1>
      <p className="mb-8 max-w-[540px] text-center font-sans text-[15px] leading-relaxed text-white/55">
        We hide the recommendation until the Pulse API returns{" "}
        <strong className="text-white/78">everything</strong>—headline, synthesis, radar tie-ins, and curated resources.
        Duration depends on synthesis load and radar context size, not staged UI timings.
      </p>

      <ul className="mb-10 w-full max-w-[460px] space-y-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4 text-left font-sans text-[14px] leading-snug text-white/72">
        <li className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-teal" aria-hidden />
          Holds until the briefing is fully composed—no halfway page.
        </li>
        <li className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-teal" aria-hidden />
          Spinner only marks “waiting”; it is not timed to mimic internal steps.
        </li>
        <li className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-teal" aria-hidden />
          If the AI-assisted response does not complete, we automatically ask the API again for a deterministic,
          intake-tuned briefing—still one full page, same parameters.
        </li>
      </ul>

      <div className="h-1 w-full max-w-[460px] overflow-hidden rounded-full bg-white/10">
        <div
          className="loading-bar-indeterminate h-full rounded-full bg-gradient-to-r from-pulse-red to-pulse-teal"
          aria-hidden
        />
      </div>

      <p className="mt-6 max-w-[460px] text-center font-sans text-[12px] leading-relaxed text-white/35">
        Your intake stays in this page&rsquo;s URL—safe to bookmark or reload. We do not time out the browser while an
        answer is still in flight. If neither response succeeds, reload in a moment; your URL still carries everything we
        need.
      </p>
    </div>
  );
}
