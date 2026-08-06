import type { Metadata } from "next";
import type { ReactNode } from "react";

import ContactForm from "@/components/ContactForm";
import GlobalFooter from "@/components/GlobalFooter";
import GlobalHeader from "@/components/GlobalHeader";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, contactPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "Tell us what you're working on. Reach the PulseOne team by form or phone for managed business technology, security, compliance, and advisory work.";

export const metadata: Metadata = {
  // Absolute: the root template would otherwise render "Contact PulseOne | PulseOne".
  title: { absolute: "Contact PulseOne" },
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    title: "Contact PulseOne",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact PulseOne",
    description: DESCRIPTION,
  },
};

function ContactDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-sans text-[12px] font-semibold tracking-[1.5px] text-[#777] uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-sans text-[15px] leading-relaxed font-medium text-[#111]">{children}</dd>
    </div>
  );
}

function PhoneLink({ display, tel }: { display: string; tel: string }) {
  return (
    <a href={`tel:${tel}`} className="font-semibold text-pulse-teal hover:underline">
      {display}
    </a>
  );
}

function ContactInfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-light-bg px-6 py-6 md:px-7 md:py-7">
      <h3 className="mb-5 font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
        {title}
      </h3>
      <dl className="space-y-4">{children}</dl>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <GlobalHeader />
      <JsonLd data={contactPageSchema()} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact" }])} />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b-4 border-pulse-teal bg-[#111] px-8 py-16">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,15,0.82)] via-[rgba(10,10,15,0.65)] to-[rgba(10,10,15,0.45)]"
            aria-hidden
          />
          <div className="relative z-[1] mx-auto max-w-[1200px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-teal/30 bg-pulse-teal/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse-teal" aria-hidden />
              <span className="font-sans text-[13px] font-semibold tracking-[2px] text-pulse-teal uppercase">
                Let&rsquo;s Talk
              </span>
            </div>
            <h1 className="mb-4 max-w-[820px] font-sans text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-white">
              Tell us what you&rsquo;re working on.
            </h1>
            <p className="max-w-[680px] font-sans text-lg leading-relaxed text-white/60">
              Send us a note and one of our advisors will reply within one business day. There&rsquo;s
              no pitch on either side &mdash; we listen first.
            </p>
          </div>
        </section>

        <section className="bg-light-bg px-6 py-16 md:py-20">
          <div className="mx-auto max-w-[640px]">
            <div className="rounded-2xl border border-[#e0e0e0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
              <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-red uppercase">
                Send us a Message
              </span>
              <h2 className="mb-3 font-sans text-[32px] leading-tight font-bold tracking-tight text-[#111]">
                We&rsquo;ll get back to you soon.
              </h2>
              <p className="mb-6 font-sans text-[14.5px] leading-relaxed text-[#555]">
                Share a bit about your situation and what you&rsquo;d like a sounding board on. An
                advisor will follow up within one business day.
              </p>
              <ContactForm />
            </div>
          </div>
        </section>

        <section className="border-t border-[#e0e0e0] bg-white px-8 py-14">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-10 text-center">
              <span className="mb-2 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
                Other Ways to Reach Us
              </span>
              <h2 className="font-sans text-[28px] font-bold tracking-tight text-[#111]">
                Old-school works too.
              </h2>
            </div>

            <div className="mb-6 grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e0e0e0] bg-light-bg px-5 py-5 text-center">
                <span className="mb-1 block font-sans text-[13px] font-semibold tracking-[2px] text-[#777] uppercase">
                  General inquiries
                </span>
                <a
                  href="mailto:marketing@pulseone.com"
                  className="font-sans text-[15px] font-semibold text-pulse-teal hover:underline"
                >
                  marketing@pulseone.com
                </a>
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

            <div className="grid gap-6 lg:grid-cols-2">
              <ContactInfoCard title="Corporate office">
                <ContactDetail label="Address">
                  <address className="not-italic">
                    PulseOne Group
                    <br />
                    1996 Eastman Avenue, Suite 111
                    <br />
                    Ventura, California 93003
                  </address>
                </ContactDetail>
                <ContactDetail label="Telephone">
                  <PhoneLink display="800.422.1156" tel="+18004221156" />
                </ContactDetail>
                <ContactDetail label="Emergency (after hours)">
                  <PhoneLink display="800.422.1156 x5" tel="+18004221156" />
                </ContactDetail>
                <ContactDetail label="Support / service">
                  <PhoneLink display="800.422.1156 x1" tel="+18004221156" />
                </ContactDetail>
                <ContactDetail label="Support email">
                  <a
                    href="mailto:support@pulseone.com"
                    className="font-semibold text-pulse-teal hover:underline"
                  >
                    support@pulseone.com
                  </a>
                  <span className="mt-0.5 block font-sans text-[13px] font-normal text-[#555]">
                    For submitting support tickets
                  </span>
                </ContactDetail>
                <ContactDetail label="Sales">
                  <PhoneLink display="866.877.7187 x1" tel="+18668777187" />
                </ContactDetail>
              </ContactInfoCard>

              <ContactInfoCard title="Regional offices">
                <ContactDetail label="Eastern region (New Jersey)">
                  <PhoneLink display="732-913-0060" tel="+17329130060" />
                </ContactDetail>
                <ContactDetail label="Central region (Nashville)">
                  <PhoneLink display="629-895-0400" tel="+16298950400" />
                </ContactDetail>
                <ContactDetail label="Mountain region (Bozeman)">
                  <PhoneLink display="406-898-2300" tel="+14068982300" />
                </ContactDetail>
                <ContactDetail label="West region: Los Angeles">
                  <PhoneLink display="213.802.0388" tel="+12138020388" />
                </ContactDetail>
                <ContactDetail label="West region: Santa Barbara / Ventura">
                  <PhoneLink display="805.901.8511" tel="+18059018511" />
                </ContactDetail>
              </ContactInfoCard>
            </div>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
