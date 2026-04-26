"use client";

import Link from "next/link";

import NewsletterSandboxPanel from "@/components/admin/NewsletterSandboxPanel";
import NewsletterTestSendPanel from "@/components/admin/NewsletterTestSendPanel";

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Newsletter</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure and test the email digest. Public radar visibility is managed on{" "}
          <Link href="/admin/publishing" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Publishing
          </Link>
          ; the chart preview is on{" "}
          <Link href="/admin/radar-preview" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Radar Preview
          </Link>
          .
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-gray-700/80 bg-gray-900/40 px-4 py-3 text-sm leading-relaxed text-gray-400">
        <strong className="text-gray-200">Newsletter vs “On public radar”:</strong> Scheduled sends and pipeline test
        emails use topics in <strong className="text-gray-300">Watched</strong> or <strong className="text-gray-300">Selected</strong>{" "}
        (Trend Discovery). That list does <strong className="text-gray-200">not</strong> update automatically from
        publishing toggles alone — turning a topic on for the live site does not add it to email unless it is in the
        pipeline. To change what subscribers receive, move topics in/out of Watched or Selected.
      </div>

      <NewsletterTestSendPanel />

      <section aria-labelledby="preview-heading">
        <h2
          id="preview-heading"
          className="text-lg font-semibold text-white"
        >
          Newsletter Preview
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          HTML-only simulation with industry/domain/role filters. Uses the same watched/selected pipeline cohort as the
          scheduled send (domains narrow topics the same way as subscriber preferences).
        </p>
        <NewsletterSandboxPanel embedded />
      </section>

      <section aria-labelledby="inbox-heading" className="mt-10 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 id="inbox-heading" className="text-lg font-semibold text-white">
          Ratings and feedback moved to Inbox
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Newsletter rating responses now live in the dedicated{" "}
          <Link href="/admin/inbox" className="text-[#019E7C] underline underline-offset-2 hover:text-teal-300">
            Inbox
          </Link>{" "}
          area, where rating-system stats are separated from future free-form feedback.
        </p>
      </section>
    </div>
  );
}
