import type { Metadata } from "next";

import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

const DESCRIPTION =
  "Three free self-assessments covering cyber insurance readiness, Copilot readiness, and disaster recovery. Scored by section and finished in one sitting.";

/**
 * The assessments page is a client component (filter state), so metadata lives
 * in this layout.
 */
export const metadata: Metadata = {
  title: "Free IT Readiness Assessments for Executives",
  description: DESCRIPTION,
  alternates: { canonical: "/assessments" },
  openGraph: {
    type: "website",
    url: "/assessments",
    title: "Free IT Readiness Assessments for Executives",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Free IT Readiness Assessments for Executives",
    description: DESCRIPTION,
  },
};

export default function AssessmentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Assessments" }])} />
      {children}
    </>
  );
}
