"use client";

import Link from "next/link";

import NewsletterSandboxPanel from "./NewsletterSandboxPanel";

/**
 * Newsletter modeling only — shows how watched/selected-topic stories render in email for each persona.
 * Radar visibility is controlled in the Publish step; batch email send is under System Jobs.
 */
export default function WorkbenchNewsletterPreviewTab() {
  return (
    <div className="max-w-7xl">
      <h2 className="text-xl font-semibold text-white">Newsletter preview</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        Model how the digest will read for different industries, domains, and roles. The email pulls from the same
        watched and selected topics and articles that power the public radar — it does not replace radar publishing. When you are
        happy with the look, continue to <strong className="text-gray-300">Preview &amp; Publish</strong> to choose what
        appears on the live radar, or open the{" "}
        <Link href="/admin/newsletter" className="text-indigo-400 hover:underline">
          full preview page
        </Link>{" "}
        in a larger layout.
      </p>
      <p className="mt-2 text-xs text-gray-600">
        Batch newsletter send:{" "}
        <Link href="/admin/jobs" className="text-gray-400 hover:text-indigo-400">
          System Jobs → Send Daily Newsletter
        </Link>
        .
      </p>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <NewsletterSandboxPanel embedded />
      </div>
    </div>
  );
}
