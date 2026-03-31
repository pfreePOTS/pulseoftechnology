"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { adminFetch, API_BASE } from "@/lib/api";
import TopicEditor from "./TopicEditor";

interface Article {
  id: number;
  title: string;
  url: string;
  content: string | null;
  status: string;
  what_is_it: string | null;
  why_it_matters: string | null;
  tags: string[] | null;
}

interface TopicDetail {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
  adoption_state: string;
  industry_positions: Record<string, { urgency_score: number; adoption_state: string }> | null;
  status: string;
  is_published: boolean;
  articles: Article[];
}

export default function TopicDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [topic, setTopic] = useState<TopicDetail | null | "loading">("loading");

  useEffect(() => {
    adminFetch(`${API_BASE}/api/admin/topics/${id}`, {
      cache: "no-store",
    } as RequestInit)
      .then((r) => (r.status === 404 ? null : r.ok ? r.json() : Promise.reject()))
      .then(setTopic)
      .catch(() => setTopic(null));
  }, [id]);

  if (topic === "loading") {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (topic === null) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-red-400">Topic not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <TopicEditor topic={topic} />
    </div>
  );
}
