import type { Metadata } from "next";
import Link from "next/link";

import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";

/** Redirect target for meeting requests from the email system. Keep this path stable. */
export const metadata: Metadata = {
  title: { absolute: "Meeting Request Received | PulseOne" },
  description: "Thanks for your meeting request. Someone from our team will get back to you shortly.",
  alternates: { canonical: "/appointment-confirmation" },
  robots: { index: false, follow: true },
};

export default function AppointmentConfirmationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        <section className="border-b-4 border-pulse-teal bg-[#111] px-6 py-20">
          <div className="mx-auto max-w-[800px] text-center">
            <span className="mb-4 inline-block rounded-full border border-pulse-teal/35 bg-pulse-teal/12 px-3.5 py-1.5 font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
              Request Received
            </span>
            <h1 className="font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              Thanks for your meeting request.
            </h1>
            <p className="mx-auto mt-5 max-w-[600px] font-sans text-lg leading-relaxed text-white/78">
              Someone from our team will get back to you shortly to confirm a time.
            </p>
          </div>
        </section>
        <section className="bg-white px-6 py-14">
          <div className="mx-auto flex max-w-[800px] flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="rounded bg-pulse-red px-8 py-[13px] text-center font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a81117]"
            >
              Back to Home
            </Link>
            <Link
              href="/radar"
              className="rounded border-2 border-pulse-teal px-8 py-[11px] text-center font-sans text-sm font-semibold text-pulse-teal transition-colors hover:bg-pulse-teal hover:text-white"
            >
              Explore the Pulse of Technology Radar
            </Link>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
