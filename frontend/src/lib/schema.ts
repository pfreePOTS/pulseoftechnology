/**
 * schema.org JSON-LD builders.
 *
 * Facts here come from `backend/content/pulseone-identity.md` and the global
 * footer. Never add a field that cannot be verified from those sources —
 * fabricated founding dates, ratings, or profile links are a structured-data
 * policy violation and teach models a wrong fact that is hard to correct.
 *
 * `Organization` and `WebSite` are emitted once in the root layout; everything
 * else references the organization by `@id` instead of repeating it.
 */

import {
  FOUNDING_YEAR,
  LEGAL_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Topical authority signals. Sourced from the in-scope service list. */
const KNOWS_ABOUT = [
  "Managed business technology services",
  "Co-managed IT services",
  "Remote and multi-site IT support",
  "IT help desk and escalation",
  "Monitoring, backups, and patching",
  "Cybersecurity and compliance reviews",
  "Cloud and Microsoft workplace platforms",
  "Software and line-of-business integration",
  "Business data management",
  "Technology policy management",
  "Phone and VoIP systems",
  "Identity and access management",
  "Technology assessments and advisory",
  "Intelligent automation with guardrails",
];

export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/pulseone_logo_official.png"),
    },
    description: SITE_DESCRIPTION,
    foundingDate: FOUNDING_YEAR,
    slogan: SITE_TAGLINE,
    areaServed: { "@type": "Country", name: "United States" },
    knowsAbout: KNOWS_ABOUT,
  };
}

export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-US",
  };
}

export function serviceSchema(input: {
  name: string;
  serviceType: string;
  description: string;
  path: string;
  audience?: string;
  includes?: string[];
}): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    serviceType: input.serviceType,
    description: input.description,
    url: absoluteUrl(input.path),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: "United States" },
  };

  if (input.audience) {
    schema.audience = { "@type": "BusinessAudience", name: input.audience };
  }

  // Decomposing the service lets a model match a narrow question ("who handles
  // patching for restaurant chains") against a component rather than the
  // umbrella name.
  if (input.includes?.length) {
    schema.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: input.name,
      itemListElement: input.includes.map((item) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: item },
      })),
    };
  }

  return schema;
}

export type FaqItem = { question: string; answer: string };

export function faqSchema(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbSchema(
  trail: Array<{ name: string; path?: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      // The current page is the last crumb and carries no `item`.
      ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
    })),
  };
}

export function contactPageSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: absoluteUrl("/contact"),
    name: `Contact ${SITE_NAME}`,
    about: { "@id": ORGANIZATION_ID },
  };
}
