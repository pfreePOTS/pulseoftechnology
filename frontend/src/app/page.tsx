import RadarSection from "@/components/RadarSection";
import TrackedStoriesSection, {
  type TrackedArticle,
} from "@/components/TrackedStoriesSection";
import SubscribeWizard from "@/components/SubscribeWizard";
import { type RadarTopic } from "@/components/RadarChart";
import { API_BASE } from "@/lib/api";

/** Server-side only: URL the Next.js server uses to call the API (browser still uses NEXT_PUBLIC_API_URL). In Docker, must be http://backend:8000 — localhost would point at this container, not the API. */
const SSR_API_BASE =
  process.env.SERVER_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  API_BASE;

async function getPublishedTopics(): Promise<RadarTopic[]> {
  try {
    const res = await fetch(`${SSR_API_BASE}/api/topics/published`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getTrackedArticles(): Promise<TrackedArticle[]> {
  try {
    const res = await fetch(`${SSR_API_BASE}/api/articles/tracked?limit=12`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Adoption-state descriptions for the instructions section
const ADOPTION_STATES = [
  {
    label: "Learn About",
    desc: "Emerging signals worth monitoring. No immediate action required.",
  },
  {
    label: "Get Ahead Of",
    desc: "Trends accelerating fast. Start building awareness and strategy.",
  },
  {
    label: "Get Prepared For",
    desc: "Near-term impact expected. Develop plans and allocate resources.",
  },
  {
    label: "Get Your Hands Around",
    desc: "Active adoption needed. Engage teams and begin implementation.",
  },
  {
    label: "Make the Most Of",
    desc: "Highest urgency. Maximise value extraction and competitive advantage.",
  },
];

export default async function Home() {
  const [topics, trackedArticles] = await Promise.all([
    getPublishedTopics(),
    getTrackedArticles(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* ── Header (brand: white bar + logo) ─────────────────────────────── */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/pulseone_logo_main.webp"
              alt="PulseOne"
              width={200}
              height={40}
              className="h-8 w-auto"
            />
            <span className="hidden text-sm text-gray-500 sm:inline">Industry Radar</span>
          </div>
          <nav>
            <a
              href="/admin"
              className="text-sm text-gray-600 transition-colors hover:text-gray-900"
            >
              Curation Dashboard →
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-16 text-center">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-4xl font-bold text-pulse-teal sm:text-5xl">
            Technology Intelligence for C-Suite Leaders
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600">
            Cut through the noise. Know exactly which emerging technologies matter
            to your industry, what your posture should be, and when to act.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#radar"
              className="inline-flex rounded-lg bg-pulse-teal px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Explore the Radar
            </a>
            <a
              href="#subscribe"
              className="inline-flex rounded-lg border-2 border-pulse-teal bg-white px-6 py-3 text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal/5"
            >
              Get the Briefing
            </a>
          </div>
        </div>
      </section>

      {/* ── Control Bar + Radar (rendered by RadarSection) ─────────────────── */}
      <div id="radar" className="scroll-mt-4">
        <RadarSection topics={topics} />
      </div>

      {/* ── How to Read the Radar ───────────────────────────────────────────── */}
      <section className="bg-pulse-surface px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-6 text-lg font-bold text-pulse-teal">How to Read the Radar</h2>
          <p className="mb-6 text-sm text-gray-600">
            Each star represents a technology signal for an industry. Its position on a spoke
            indicates the recommended adoption posture. Distance from the centre combines{" "}
            <strong className="font-medium text-gray-800">impact</strong> (stronger signals sit further out) and{" "}
            <strong className="font-medium text-gray-800">risk</strong> (regulatory, compliance, and exposure pull
            inward toward the core). Star colour shows the industry.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADOPTION_STATES.map(({ label, desc }, i) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 bg-white p-4"
              >
                <div className="mb-2 inline-block rounded-full bg-pulse-teal px-3 py-0.5 text-xs font-semibold text-white">
                  {i + 1}. {label}
                </div>
                <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tracked stories (ingested articles for published topics) ───────────── */}
      {trackedArticles.length > 0 && (
        <TrackedStoriesSection articles={trackedArticles} />
      )}

      {/* ── Subscribe Section ───────────────────────────────────────────────── */}
      <section
        id="subscribe"
        className="scroll-mt-4 bg-white px-6 py-14"
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-pulse-teal">
            Get Personalised Intelligence
          </h2>
          <p className="mb-8 text-center text-gray-600">
            Receive curated radar briefings tailored to your industry and
            domains — delivered daily to your inbox.
          </p>
          <SubscribeWizard apiBase={API_BASE} />
        </div>
      </section>

      {/* ── Red Footer CTA ──────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#E91D24" }} className="px-6 py-10 shrink-0">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">
              Ready to put intelligence to work?
            </p>
            <p className="mt-1 text-sm text-white/80">
              Let PulseOne help your leadership team stay ahead of the curve.
            </p>
          </div>
          <a
            href="mailto:hello@pulseone.com"
            className="shrink-0 rounded-lg bg-white px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ color: "#E91D24" }}
          >
            Contact Us
          </a>
        </div>
        <div
          className="mx-auto mt-8 max-w-7xl border-t pt-6 text-center text-xs text-white/50"
          style={{ borderColor: "rgba(255,255,255,0.2)" }}
        >
          © {new Date().getFullYear()} PulseOne · Technology Intelligence for
          C-Suite Leaders
        </div>
      </footer>
    </div>
  );
}
