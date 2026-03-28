import { notFound } from "next/navigation";
import TopicEditor from "./TopicEditor";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Article {
  id: number;
  title: string;
  url: string;
  content: string | null;
  status: string;
}

interface IndustryPosition {
  urgency_score: number;
  adoption_state: string;
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, IndustryPosition> | null;
  status: string;
  articles: Article[];
}

async function getTopic(id: string): Promise<TopicDetail | null> {
  const res = await fetch(`${API_BASE}/api/admin/topics/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load topic ${id}`);
  return res.json();
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const topic = await getTopic(id);

  if (!topic) notFound();

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <TopicEditor topic={topic} apiBase={API_BASE} />
      </div>
    </main>
  );
}
