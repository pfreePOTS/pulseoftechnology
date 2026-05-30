/**
 * Skeleton shown while `everyone/page.tsx` (Server Component) awaits the
 * `/api/everyone-overview` fetch. Mirrors the live layout — Hero, Context,
 * Radar Snapshot, Recent Resources, How We Work, contact CTA band.
 */

export default function EveryoneLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the broad executive overview…</span>

      {/* Header bar */}
      <div className="h-[96px] animate-pulse bg-gray-200" />

      {/* Hero */}
      <div className="border-b-4 border-pulse-teal bg-[#111] px-8 py-16">
        <div className="mx-auto max-w-[1100px] space-y-4">
          <div className="h-6 w-56 animate-pulse rounded-full bg-white/10" />
          <div className="h-12 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
          <div className="flex flex-wrap gap-2.5 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-32 animate-pulse rounded-md bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="bg-light-bg px-8 py-16">
        <div className="mx-auto max-w-[1100px] space-y-6">
          <div className="mx-auto h-4 w-44 animate-pulse rounded bg-gray-200" />
          <div className="mx-auto h-8 w-2/3 max-w-[680px] animate-pulse rounded bg-gray-200" />
          <div className="mx-auto h-44 max-w-[820px] animate-pulse rounded-lg border-l-4 border-l-pulse-teal bg-gray-200" />
          <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* Radar snapshot */}
      <div className="bg-dark-bg px-8 py-16">
        <div className="mx-auto max-w-[1100px] space-y-6">
          <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
          <div className="h-8 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-[10px] bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>

      {/* Recent resources */}
      <div className="bg-white px-6 py-20">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <div className="mx-auto h-4 w-44 animate-pulse rounded bg-gray-200" />
          <div className="mx-auto h-8 w-1/2 animate-pulse rounded bg-gray-200" />
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        </div>
      </div>

      {/* How We Work — 4 steps */}
      <div className="border-t border-[#e0e0e0] bg-light-bg px-8 py-20">
        <div className="mx-auto max-w-[1100px] space-y-8">
          <div className="mx-auto h-8 w-1/2 max-w-md animate-pulse rounded bg-gray-200" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[10px] bg-gray-200" />
            ))}
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className="border-t-[3px] border-pulse-red bg-dark-bg px-8 pt-20 pb-16">
        <div className="mx-auto max-w-[760px] space-y-6 text-center">
          <div className="mx-auto h-4 w-40 animate-pulse rounded bg-white/10" />
          <div className="mx-auto h-10 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="mx-auto h-12 w-48 animate-pulse rounded-md bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}
