import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";

/**
 * Boundary while `/radar` Server Component awaits SSR API (`topics`, `tracked` JSON).
 * Includes global chrome so switching from skeleton → radar does not wipe the nav.
 */
export default function RadarLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <GlobalHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24" aria-busy="true">
        <span className="sr-only">Loading Pulse of Technology radar</span>
        <div className="mb-8 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-pulse-teal/8">
          <div
            className="h-14 w-14 rounded-full border-4 border-pulse-teal/20 border-t-pulse-teal animate-spin"
            aria-hidden
          />
        </div>
        <p className="font-sans text-lg font-semibold text-[#111]">Opening the radar</p>
        <p className="mt-2 max-w-md text-center font-sans text-sm leading-relaxed text-[#555]">
          Fetching trending topics and recent briefing stories. If this hangs, verify the Pulse API is
          running (e.g. <span className="font-mono text-xs">docker compose up</span>) — server-side loads
          use <span className="font-mono text-xs">SERVER_API_URL</span> inside the frontend container
          (<span className="font-mono text-xs">http://backend:8000</span> in Compose).
        </p>
      </main>
      <GlobalFooter />
    </div>
  );
}
