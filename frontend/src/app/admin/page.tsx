import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Topic {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  status: string;
}

async function getPendingTopics(): Promise<Topic[]> {
  const res = await fetch(`${API_BASE}/api/admin/topics`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

function UrgencyBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-red-500/20 text-red-400 ring-red-500/30"
      : score >= 5
        ? "bg-amber-500/20 text-amber-400 ring-amber-500/30"
        : "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  const palette: Record<string, string> = {
    AI: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
    Security: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
    Cloud: "bg-sky-500/20 text-sky-400 ring-sky-500/30",
    Finance: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    Leadership: "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30",
  };
  const cls =
    palette[domain] ?? "bg-slate-500/20 text-slate-400 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {domain}
    </span>
  );
}

export default async function AdminTopicsPage() {
  const topics = await getPendingTopics();

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Curation Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Review and approve AI-generated topic briefings before publishing.
          </p>
        </header>

        {topics.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">
              No pending topics
            </p>
            <p className="mt-1 text-sm text-gray-500">
              All topics have been reviewed, or none have been processed yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-gray-400">Topic</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Domain</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Urgency
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topics.map((topic) => (
                  <tr
                    key={topic.id}
                    className="group transition-colors hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{topic.name}</p>
                      {topic.summary && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                          {topic.summary}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DomainBadge domain={topic.domain} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UrgencyBadge score={topic.urgency_score} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/topics/${topic.id}`}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-600">
          {topics.length} topic{topics.length !== 1 ? "s" : ""} pending review
        </p>
      </div>
    </main>
  );
}
