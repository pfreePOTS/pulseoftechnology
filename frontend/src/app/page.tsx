import RadarSection from "@/components/RadarSection";
import SubscribeWizard from "@/components/SubscribeWizard";
import { type RadarTopic, INDUSTRY_COLORS } from "@/components/RadarChart";
import { API_BASE } from "@/lib/api";

async function getPublishedTopics(): Promise<RadarTopic[]> {
  try {
    const res = await fetch(`${API_BASE}/api/topics/published`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Legend sourced directly from RadarChart's exported INDUSTRY_COLORS
const INDUSTRY_LEGEND = Object.entries(INDUSTRY_COLORS).map(([name, color]) => ({
  name,
  color,
}));

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
  const topics = await getPublishedTopics();

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* ── Dark Teal Header ─────────────────────────────────────────────────── */}
      <header style={{ backgroundColor: "#425B76" }} className="px-6 py-4 shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#E91D24" }}
            />
            <span className="text-lg font-bold tracking-wide text-white">
              PulseOne
            </span>
            <span className="hidden text-sm text-white/60 sm:inline">
              Industry Radar
            </span>
          </div>
          <nav>
            <a
              href="/admin"
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              Curation Dashboard →
            </a>
          </nav>
        </div>
      </header>

      {/* ── Control Bar + Radar (rendered by RadarSection) ─────────────────── */}
      <RadarSection topics={topics} />

      {/* ── Light Gray Legend Bar ───────────────────────────────────────────── */}
      <div
        style={{ backgroundColor: "#E5E5E5" }}
        className="border-y border-gray-300 px-6 py-4 shrink-0"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "#425B76" }}
          >
            Domains
          </span>
          {INDUSTRY_LEGEND.map(({ name, color }) => (
            <span key={name} className="flex items-center gap-1.5 text-sm text-gray-700">
              {/* Mini star icon using clip-path */}
              <span
                className="inline-block h-3 w-3 shrink-0"
                style={{
                  backgroundColor: color,
                  clipPath:
                    "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
                }}
              />
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* ── How to Read the Radar ───────────────────────────────────────────── */}
      <section className="bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-6 text-lg font-bold" style={{ color: "#425B76" }}>
            How to Read the Radar
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            Each star represents a technology signal. Its position on a spoke
            indicates the recommended adoption posture; distance from centre
            reflects urgency (higher urgency = further out). Star colour shows
            the domain.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADOPTION_STATES.map(({ label, desc }, i) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <div
                  className="mb-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#425B76" }}
                >
                  {i + 1}. {label}
                </div>
                <p className="text-sm leading-relaxed text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Published Briefings ─────────────────────────────────────────────── */}
      {topics.length > 0 && (
        <section
          style={{ backgroundColor: "#E5E5E5" }}
          className="border-t border-gray-300 px-6 py-12"
        >
          <div className="mx-auto max-w-7xl">
            <h2
              className="mb-6 text-lg font-bold"
              style={{ color: "#425B76" }}
            >
              Published Briefings
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((topic) => {
                // Use the first industry position's colour if available, else domain fallback
                const firstIndustry = topic.industry_positions
                  ? Object.keys(topic.industry_positions)[0]
                  : null;
                const color = firstIndustry
                  ? (INDUSTRY_COLORS[firstIndustry] ?? "#6B7280")
                  : "#6B7280";
                return (
                  <article
                    key={topic.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {topic.domain}
                      </span>
                      <span className="text-xs text-gray-500">
                        Urgency {topic.urgency_score.toFixed(1)}
                      </span>
                    </div>
                    <h3
                      className="font-semibold"
                      style={{ color: "#425B76" }}
                    >
                      {topic.name}
                    </h3>
                    {topic.summary && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">
                        {topic.summary}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Subscribe Section ───────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2
            className="mb-2 text-center text-2xl font-bold"
            style={{ color: "#425B76" }}
          >
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
