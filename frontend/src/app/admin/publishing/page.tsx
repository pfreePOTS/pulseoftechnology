"use client";

import Link from "next/link";

import RadarPublishingSection from "@/components/admin/RadarPublishingSection";

export default function PublishingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Publishing</h1>
        <p className="mt-1 text-sm text-gray-400">
          Control what appears on the <strong className="text-gray-300">public</strong> Technology Radar. For email
          testing and HTML preview, use{" "}
          <Link href="/admin/newsletter" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Newsletter
          </Link>
          .
        </p>
      </div>

      <RadarPublishingSection />
    </div>
  );
}
