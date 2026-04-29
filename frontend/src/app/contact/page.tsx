import BookingCalendar from "@/components/BookingCalendar";
import ContactForm from "@/components/ContactForm";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";

export const metadata = {
  title: "Contact Us — PulseOne",
  description:
    "Schedule a call or send us a message. Two ways to start the conversation with PulseOne — pick whichever fits your week.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <main className="flex-1">
        {/* HERO — same dark, full-bleed framing as /industries and /everyone. */}
        <section className="relative overflow-hidden border-b-4 border-pulse-teal bg-[#111] px-8 py-16">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.65)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1100px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                Let&rsquo;s Talk
              </span>
            </div>
            <h1 className="mb-4 max-w-[820px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              Two ways to start the conversation.
            </h1>
            <p className="max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              Book a call directly, or send us a note and one of our advisors will reply within
              one business day. There&rsquo;s no pitch on either side &mdash; we listen first.
            </p>
          </div>
        </section>

        {/* SCHEDULE + FORM — two equal columns on lg, stacked otherwise. */}
        <section className="bg-light-bg px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-2 lg:gap-10">
            {/* LEFT — Schedule a Call. Reuses the same `BookingCalendar` widget
                as `/recommended-path`. Card sits on a dark surface to echo the
                dark hero and visually distinguish "calendar" from "form". */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-dark-bg p-6 md:p-8">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Schedule a Call
              </span>
              <h2 className="mb-3 font-sans text-[32px] leading-tight font-bold tracking-tight text-white">
                Pick a 30-minute slot.
              </h2>
              <p className="mb-2 font-sans text-[14.5px] leading-relaxed text-white/60">
                A no-pressure conversation with one of our advisors. We listen first &mdash; no
                pitch, no agenda, just an honest read on where you are.
              </p>
              <BookingCalendar />
            </div>

            {/* RIGHT — Send us a message. Light card with the contact form. */}
            <div className="rounded-2xl border border-[#e0e0e0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-red uppercase">
                Send us a Message
              </span>
              <h2 className="mb-3 font-sans text-[32px] leading-tight font-bold tracking-tight text-[#111]">
                Prefer to write it out?
              </h2>
              <p className="mb-6 font-sans text-[14.5px] leading-relaxed text-[#555]">
                Tell us a bit about your situation and an advisor will get back to you within one
                business day.
              </p>
              <ContactForm />
            </div>
          </div>
        </section>

        {/* OTHER WAYS — quiet footer band with email + office hours. */}
        <section className="border-t border-[#e0e0e0] bg-white px-8 py-14">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-8 text-center">
              <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Other Ways to Reach Us
              </span>
              <h2 className="font-sans text-[28px] font-bold tracking-tight text-[#111]">
                Old-school works too.
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="rounded-lg border border-[#e0e0e0] bg-light-bg px-5 py-5 text-center">
                <span className="mb-1 block font-sans text-[13px] font-semibold tracking-[2px] text-[#777] uppercase">
                  Email
                </span>
                <a
                  href="mailto:hello@pulseone.com"
                  className="font-sans text-[15px] font-semibold text-pulse-teal hover:underline"
                >
                  hello@pulseone.com
                </a>
              </div>
              <div className="rounded-lg border border-[#e0e0e0] bg-light-bg px-5 py-5 text-center">
                <span className="mb-1 block font-sans text-[13px] font-semibold tracking-[2px] text-[#777] uppercase">
                  Hours
                </span>
                <p className="font-sans text-[15px] font-semibold text-[#111]">
                  Mon&ndash;Fri &middot; 8am&ndash;6pm ET
                </p>
              </div>
              <div className="rounded-lg border border-[#e0e0e0] bg-light-bg px-5 py-5 text-center">
                <span className="mb-1 block font-sans text-[13px] font-semibold tracking-[2px] text-[#777] uppercase">
                  Response
                </span>
                <p className="font-sans text-[15px] font-semibold text-[#111]">
                  Within 1 business day
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
