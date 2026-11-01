# PulseOne SEO Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make this Next.js app able to replace the WordPress site on pulseone.com without dropping the URLs Google already knows, while leaving DNS, the HubSpot blog, and the 82 apex blog posts untouched.

**Status (2026-10-31):** Tasks 2, 3, 4, and 5 are implemented on the `dev` branch and verified at http://localhost:3100. Task 1 (the redirect table) waits until those pages are approved. This is not on Railway staging, and it is not committed.

**Architecture:** One redirect table in `frontend/src/lib/legacyRedirects.ts` is the only list of old paths. `next.config.ts` spreads it. City pages and the privacy page are new indexable routes that give the highest-value old URLs a real destination. The homepage document title picks up "Managed IT"; the designed hero H1 stays. A `NEXT_PUBLIC_ROBOTS_INDEX=false` switch noindexes any host that is not the live cutover. Canonicals stay on `NEXT_PUBLIC_SITE_URL` and must not be set to `https://pulseone.com` until that host actually serves this app.

**Tech Stack:** Next.js 16 App Router, `next.config.ts` `redirects()`, Vitest, existing `GlobalHeader` / `GlobalFooter` / sitemap / robots.

## Global Constraints

- Do not change DNS, Flywheel, HubSpot, or Search Console in this plan.
- Do not set `NEXT_PUBLIC_SITE_URL=https://pulseone.com` in this plan. That happens in the deploy that actually serves the domain.
- Do not 301 the 82 WordPress posts. They need their own map onto blog.pulseone.com, and that map is a gate before DNS cutover, not part of this work.
- Do not change `https://pulseone.com/contact-us/` inside email or marketplace code. After cutover, `/contact-us` 301s to `/contact`, so those links keep working.
- Do not rewrite the homepage hero H1. The document `<title>` is the SEO change.
- Permanent redirects only (`permanent: true`, Next.js 308).
- Redirect `source` values have no trailing slash. Next strips the WordPress slash before matching.
- Copy for the privacy page is the current pulseone.com policy, ported verbatim. Do not draft new legal language.
- Location copy stays specific and plain. No "world class", "best in class", or "thought leader".
- Colors and type stay on the existing PulseOne tokens (`pulse-red`, `pulse-teal`, IBM Plex Sans). No `#425B76`.
- Do not commit unless the user explicitly asks during execution.

## Decisions locked for approval

1. Homepage `<title>` becomes `Managed IT Services and Business Technology | PulseOne`. Hero H1 stays "Find where your organization stands in …".
2. Five location pages, because those cities have live URLs: Los Angeles, Ventura, New Jersey, Bozeman, Philadelphia. Nashville has an office and no legacy URL, so it gets no page.
3. `/privacy-policy` 301s to a new `/privacy` page that repeats the current policy text.
4. Marketing, service, and geo URLs 301 to the closest new page (table in Task 1). Thrive, courses, profiles, and password resets are left unmapped on purpose.
5. `/blog` 301s to `https://blog.pulseone.com`. Individual apex posts are not redirected here.
6. Footer Client Login points at ConnectWise. Footer Privacy Policy points at `/privacy`.
7. Staging and any non-production public host set `NEXT_PUBLIC_ROBOTS_INDEX=false`.

## File structure

- Create: `frontend/src/lib/legacyRedirects.ts` — old path → new path. Consumed by Next config and tests.
- Create: `frontend/src/lib/legacyRedirects.test.ts`
- Modify: `frontend/next.config.ts` — spread `LEGACY_REDIRECTS`.
- Modify: `frontend/src/lib/site.ts` — `HOME_TITLE`, `HOME_DESCRIPTION`.
- Modify: `frontend/src/app/page.tsx` — use those constants.
- Create: `frontend/src/lib/site.test.ts`
- Create: `frontend/src/lib/locations.ts` — five city records.
- Create: `frontend/src/lib/locations.test.ts`
- Create: `frontend/src/app/locations/[slug]/page.tsx`
- Modify: `frontend/src/app/sitemap.ts` — locations + `/privacy`.
- Create: `frontend/src/lib/privacyPolicy.ts` — verbatim sections.
- Create: `frontend/src/app/privacy/page.tsx`
- Modify: `frontend/src/components/GlobalFooter.tsx` — login and privacy hrefs.
- Create: `frontend/src/lib/indexing.ts` — `indexingEnabled()`.
- Create: `frontend/src/lib/indexing.test.ts`
- Modify: `frontend/src/app/layout.tsx` and `frontend/src/app/robots.ts` — honor the flag.
- Modify: `.env.example` — document `NEXT_PUBLIC_ROBOTS_INDEX`.

---

### Task 1: Legacy redirect table

**Files:**
- Create: `frontend/src/lib/legacyRedirects.ts`
- Create: `frontend/src/lib/legacyRedirects.test.ts`
- Modify: `frontend/next.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `LEGACY_REDIRECTS: ReadonlyArray<{ source: string; destination: string; permanent: true }>`. Later tasks add `/privacy` and `/locations/*` as destinations; those paths are listed below so Task 1's allow-list already includes them. The pages themselves land in Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/legacyRedirects.test.ts
import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS } from "./legacyRedirects";

const DESTINATIONS = new Set([
  "/services/managed-business-technology",
  "/services/cybersecurity",
  "/services/compliance-and-risk",
  "/services/ai-and-emerging-tech",
  "/services",
  "/assessments",
  "/approach",
  "/contact",
  "/industries",
  "/privacy",
  "/locations/los-angeles",
  "/locations/ventura",
  "/locations/new-jersey",
  "/locations/bozeman",
  "/locations/philadelphia",
  "https://blog.pulseone.com",
]);

describe("legacy redirects", () => {
  it("permanent-redirects every source once, onto a known destination", () => {
    const sources = LEGACY_REDIRECTS.map((rule) => rule.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const rule of LEGACY_REDIRECTS) {
      expect(rule.permanent).toBe(true);
      expect(rule.source.endsWith("/")).toBe(false);
      expect(rule.source).not.toBe(rule.destination);
      expect(DESTINATIONS.has(rule.destination)).toBe(true);
    }
  });

  it("keeps the paths this app already serves off the redirect table", () => {
    const sources = new Set(LEGACY_REDIRECTS.map((rule) => rule.source));
    for (const live of ["/", "/assessments", "/contact", "/services", "/approach"]) {
      expect(sources.has(live)).toBe(false);
    }
  });

  it("maps the equity clusters", () => {
    const to = Object.fromEntries(LEGACY_REDIRECTS.map((rule) => [rule.source, rule.destination]));
    expect(to["/contact-us"]).toBe("/contact");
    expect(to["/our-services"]).toBe("/services/managed-business-technology");
    expect(to["/services/managed-it-services"]).toBe("/services/managed-business-technology");
    expect(to["/cyber-security-services"]).toBe("/services/cybersecurity");
    expect(to["/cmmc-compliance-services"]).toBe("/services/compliance-and-risk");
    expect(to["/ai-consulting_and_integration"]).toBe("/services/ai-and-emerging-tech");
    expect(to["/about-us"]).toBe("/approach");
    expect(to["/privacy-policy"]).toBe("/privacy");
    expect(to["/blog"]).toBe("https://blog.pulseone.com");
    expect(to["/los-angeles-it-services-company"]).toBe("/locations/los-angeles");
    expect(to["/managed-it-services-in-ventura"]).toBe("/locations/ventura");
    expect(to["/it-management-in-central-coast"]).toBe("/locations/ventura");
    expect(to["/managed-it-services-in-new-jersey"]).toBe("/locations/new-jersey");
    expect(to["/bozeman"]).toBe("/locations/bozeman");
    expect(to["/philadelphia"]).toBe("/locations/philadelphia");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/legacyRedirects.test.ts'`

Expected: FAIL, cannot find `./legacyRedirects`.

- [ ] **Step 3: Add the table and spread it from Next config**

```ts
// frontend/src/lib/legacyRedirects.ts
export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function to(sources: string[], destination: string): LegacyRedirect[] {
  return sources.map((source) => ({ source, destination, permanent: true }));
}

/** WordPress paths on pulseone.com. Apex blog posts are intentionally absent. */
export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  ...to(
    [
      "/our-services",
      "/it-management",
      "/information-technology-management",
      "/it-project-and-program-management",
      "/it-procurement-asset-license-management",
      "/it-planning-design-and-implementation",
      "/it-monitor-alert-and-manage",
      "/end-user-it-help-desk",
      "/it-storage-and-backup-management",
      "/it-communication-management",
      "/communications",
      "/small-business-it-solutions",
      "/it-consulting-company",
      "/backup-recovery-services-db2",
      "/data-backup-and-recovery-solutions-db1",
      "/it-operations-outsourcing",
      "/remote-workforce-solutions",
      "/business-continuity-solutions",
      "/business-continuity",
      "/bc",
      "/ms",
      "/ro",
      "/services/managed-it-services",
    ],
    "/services/managed-business-technology",
  ),
  ...to(
    ["/cyber-security-services", "/it-security-and-compliance-services", "/email-protection-faq"],
    "/services/cybersecurity",
  ),
  ...to(["/cmmc-compliance-services"], "/services/compliance-and-risk"),
  ...to(["/ai-consulting_and_integration"], "/services/ai-and-emerging-tech"),
  ...to(["/free-business-assessment", "/itreview"], "/assessments"),
  ...to(["/contact-us", "/inquiry"], "/contact"),
  ...to(["/about-us", "/partners"], "/approach"),
  ...to(["/solutions"], "/services"),
  ...to(["/behavioral-health", "/bh"], "/industries"),
  ...to(
    [
      "/los-angeles-it-consulting",
      "/outsourced-it-support-in-los-angeles",
      "/it-helpdesk-and-managed-services-los-angeles",
      "/it-company-los-angeles",
      "/it-support-los-angeles",
      "/los-angeles-it-services-company",
    ],
    "/locations/los-angeles",
  ),
  ...to(
    ["/managed-it-services-in-ventura", "/it-management-in-central-coast"],
    "/locations/ventura",
  ),
  ...to(["/managed-it-services-in-new-jersey"], "/locations/new-jersey"),
  ...to(["/bozeman"], "/locations/bozeman"),
  ...to(["/philadelphia"], "/locations/philadelphia"),
  ...to(["/privacy-policy"], "/privacy"),
  ...to(["/blog"], "https://blog.pulseone.com"),
];
```

In `frontend/next.config.ts`, import `LEGACY_REDIRECTS` from `./src/lib/legacyRedirects` and replace the inline `managed-it-services` redirect with `return [...LEGACY_REDIRECTS];`.

- [ ] **Step 4: Re-run the test**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/legacyRedirects.test.ts'`

Expected: PASS. `next.config.ts` is not bind-mounted into the frontend container, so this test checks the module the config spreads. Confirm the import is in `frontend/next.config.ts` on disk.

---

### Task 2: Homepage document title

**Files:**
- Modify: `frontend/src/lib/site.ts`
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/lib/site.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `HOME_TITLE` and `HOME_DESCRIPTION` string exports from `@/lib/site`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/site.test.ts
import { describe, expect, it } from "vitest";

import { HOME_DESCRIPTION, HOME_TITLE } from "./site";

describe("homepage metadata", () => {
  it("keeps the managed IT head term in the document title", () => {
    expect(HOME_TITLE).toBe("Managed IT Services and Business Technology | PulseOne");
    expect(HOME_DESCRIPTION.toLowerCase()).toContain("managed it");
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/site.test.ts'`

Expected: FAIL, `HOME_TITLE` is not exported.

- [ ] **Step 3: Export the strings and use them on the homepage**

Add to `frontend/src/lib/site.ts`:

```ts
export const HOME_TITLE = "Managed IT Services and Business Technology | PulseOne";

export const HOME_DESCRIPTION =
  "Managed IT services, security, and business technology advisory for small and mid-market organizations. PulseOne has done this work since 2002.";
```

Leave `SITE_DESCRIPTION` as it is. It still feeds the root layout and organization schema.

In `frontend/src/app/page.tsx`, set `title.absolute` to `HOME_TITLE` and `description` to `HOME_DESCRIPTION`. Do not edit `HeroSection.tsx`.

- [ ] **Step 4: Re-run the test**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/site.test.ts'`

Expected: PASS.

---

### Task 3: Location pages

**Files:**
- Create: `frontend/src/lib/locations.ts`
- Create: `frontend/src/lib/locations.test.ts`
- Create: `frontend/src/app/locations/[slug]/page.tsx`
- Modify: `frontend/src/app/sitemap.ts`

**Interfaces:**
- Consumes: `LEGACY_REDIRECTS` destinations `/locations/los-angeles`, `/locations/ventura`, `/locations/new-jersey`, `/locations/bozeman`, `/locations/philadelphia`.
- Produces: `LOCATIONS`, `getLocation(slug)`, `locationPath(slug)` returning `/locations/${slug}`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/locations.test.ts
import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS } from "./legacyRedirects";
import { LOCATIONS, getLocation, locationPath } from "./locations";

describe("location pages", () => {
  it("has one page for every location the redirect table points at", () => {
    const slugs = new Set(LOCATIONS.map((location) => location.slug));
    expect([...slugs]).toEqual([
      "los-angeles",
      "ventura",
      "new-jersey",
      "bozeman",
      "philadelphia",
    ]);
    for (const rule of LEGACY_REDIRECTS) {
      if (!rule.destination.startsWith("/locations/")) continue;
      const slug = rule.destination.slice("/locations/".length);
      expect(getLocation(slug)?.slug).toBe(slug);
      expect(locationPath(slug)).toBe(rule.destination);
    }
  });

  it("puts the city and managed IT in each title", () => {
    for (const location of LOCATIONS) {
      expect(location.metaTitle).toContain(location.city);
      expect(location.metaTitle.toLowerCase()).toContain("managed it");
      expect(location.metaDescription.length).toBeGreaterThan(40);
      expect(location.body.length).toBeGreaterThan(40);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/locations.test.ts'`

Expected: FAIL, module missing.

- [ ] **Step 3: Add the records, the route, and the sitemap entries**

```ts
// frontend/src/lib/locations.ts
export type LocationPage = {
  slug: string;
  city: string;
  metaTitle: string;
  metaDescription: string;
  lede: string;
  body: string;
  phone: string;
};

export const LOCATIONS: readonly LocationPage[] = [
  {
    slug: "los-angeles",
    city: "Los Angeles",
    metaTitle: "Managed IT Services in Los Angeles | PulseOne",
    metaDescription:
      "Managed IT, help desk, and security for Los Angeles companies. PulseOne supports West Region clients from Los Angeles and Ventura.",
    lede: "Managed IT for Los Angeles companies that want one team on the phones.",
    body: "The West Region office is in Los Angeles, with the corporate office in Ventura. Help desk, security, and project work run from that team, including sites that have no technical staff of their own.",
    phone: "213.802.0388",
  },
  {
    slug: "ventura",
    city: "Ventura",
    metaTitle: "Managed IT Services in Ventura | PulseOne",
    metaDescription:
      "Managed IT services in Ventura and along the Central Coast. PulseOne Group's corporate office is at 1996 Eastman Avenue.",
    lede: "The corporate office is in Ventura. The managed IT work covers the Central Coast from there.",
    body: "PulseOne Group is at 1996 Eastman Avenue, Suite 111, Ventura, California 93003. Central Coast and Santa Barbara clients use the same help desk and the same standards as the rest of the company.",
    phone: "805.901.8511",
  },
  {
    slug: "new-jersey",
    city: "New Jersey",
    metaTitle: "Managed IT Services in New Jersey | PulseOne",
    metaDescription:
      "Managed IT and help desk for New Jersey companies. PulseOne's Eastern Region office supports local clients and multi-site organizations.",
    lede: "Eastern Region managed IT, based in New Jersey.",
    body: "The New Jersey office covers Eastern Region clients: day-to-day support, security, and the project work that comes with more than one site.",
    phone: "732-913-0060",
  },
  {
    slug: "bozeman",
    city: "Bozeman",
    metaTitle: "Managed IT Services in Bozeman | PulseOne",
    metaDescription:
      "Managed IT services in Bozeman and the Mountain Region. Local PulseOne staff, with the same help desk the rest of the company uses.",
    lede: "Mountain Region managed IT, based in Bozeman.",
    body: "Bozeman is the Mountain Region office. Clients there get local contact and the same remote support model used for multi-site organizations elsewhere.",
    phone: "406-898-2300",
  },
  {
    slug: "philadelphia",
    city: "Philadelphia",
    metaTitle: "Managed IT Support in Philadelphia | PulseOne",
    metaDescription:
      "Managed IT support for Philadelphia companies. PulseOne covers the city from the Eastern Region team in New Jersey.",
    lede: "Managed IT support for Philadelphia, from the Eastern Region team.",
    body: "Philadelphia clients are covered by the Eastern Region office in New Jersey. Support, security, and project work use the corporate help desk number when you want a person after hours.",
    phone: "800.422.1156",
  },
];

export function getLocation(slug: string): LocationPage | undefined {
  return LOCATIONS.find((location) => location.slug === slug);
}

export function locationPath(slug: string): string {
  return `/locations/${slug}`;
}
```

`frontend/src/app/locations/[slug]/page.tsx` follows `frontend/src/app/services/[slug]/page.tsx`:

- `generateStaticParams` from `LOCATIONS`
- `generateMetadata` uses `metaTitle`, `metaDescription`, and `alternates.canonical` of `locationPath(slug)`
- `notFound()` for an unknown slug
- Render `GlobalHeader`, a breadcrumb JSON-LD (`Home` → `Locations` is omitted; trail is Home, then the city), an `<h1>` of `location.metaTitle` without the ` | PulseOne` suffix (use `Managed IT in ${location.city}`), the lede, the body, the phone, a link to `/contact`, and `GlobalFooter`
- Use the same header/main classes as the contact page: white background, IBM Plex via `font-sans`, teal used only for the existing accent, not as a new palette

In `frontend/src/app/sitemap.ts`, import `LOCATIONS` and `locationPath`, and append one entry per location at priority `0.6`, `changeFrequency: "monthly"`.

- [ ] **Step 4: Re-run the test**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/locations.test.ts src/lib/legacyRedirects.test.ts'`

Expected: PASS.

---

### Task 4: Privacy page and footer links

**Files:**
- Create: `frontend/src/lib/privacyPolicy.ts`
- Create: `frontend/src/app/privacy/page.tsx`
- Modify: `frontend/src/components/GlobalFooter.tsx`
- Modify: `frontend/src/app/sitemap.ts`

**Interfaces:**
- Consumes: redirect `/privacy-policy` → `/privacy` from Task 1.
- Produces: `PRIVACY_SECTIONS: ReadonlyArray<{ heading: string; paragraphs: string[] }>` and `PRIVACY_PATH = "/privacy"`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/privacyPolicy.test.ts
import { describe, expect, it } from "vitest";

import { PRIVACY_PATH, PRIVACY_SECTIONS } from "./privacyPolicy";

describe("privacy policy", () => {
  it("keeps the current policy's required statements", () => {
    expect(PRIVACY_PATH).toBe("/privacy");
    const text = PRIVACY_SECTIONS.map((section) =>
      [section.heading, ...section.paragraphs].join(" "),
    ).join(" ");
    expect(text).toContain("PulseOne does not sell personal information");
    expect(text).toContain("support@pulseone.com");
    expect(text).toContain("California Consumer Privacy Act");
    expect(PRIVACY_SECTIONS.map((section) => section.heading)).toEqual([
      "Information We Collect",
      "How We Use Information",
      "Cookies and Tracking Technologies",
      "Sharing of Information",
      "Data Retention",
      "Data Security",
      "Your Rights and Choices",
      "California Residents",
      "Changes to This Privacy Policy",
      "Contact Us",
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/privacyPolicy.test.ts'`

Expected: FAIL, module missing.

- [ ] **Step 3: Port the live policy and point the footer at it**

Create `frontend/src/lib/privacyPolicy.ts` with `PRIVACY_PATH = "/privacy"`, `PRIVACY_INTRO` equal to "PulseOne values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect personal information in connection with the PulseOne website and user accounts.", and `PRIVACY_SECTIONS` copied from the live policy:

- Information We Collect: "We collect limited personal information necessary to operate the Website and manage user accounts." Then the two groups, as paragraphs: "Information you provide: name, email address, account login credentials (stored in encrypted or hashed form), and communications submitted through contact or support forms." and "Information collected automatically: IP address, browser type and version, device and operating system information, log and usage data (pages visited, timestamps), and cookies and similar tracking technologies."
- How We Use Information: "We use the information described above to create and manage user accounts, authenticate users and provide secure access to assessments, operate and improve the website, respond to inquiries, monitor usage and security, and comply with legal obligations."
- Cookies and Tracking Technologies: "We use cookies and similar technologies to enable core website functionality, maintain login sessions, improve performance and security, and understand usage patterns through analytics. You can control cookies through your browser settings. Disabling cookies may affect website functionality."
- Sharing of Information: "We may share personal information with service providers that host or support the website, vendors providing analytics, security, or technical services, and legal or regulatory authorities if required by law or to protect our rights. PulseOne does not sell personal information."
- Data Retention: "We retain personal information for as long as necessary to maintain your account, provide website functionality, and comply with legal, regulatory, or contractual obligations. Information may be deleted or anonymized upon account closure, subject to applicable laws."
- Data Security: "We implement reasonable administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, disclosure, alteration, or destruction."
- Your Rights and Choices: "Depending on your location, you may have the right to access or update your account information, request deletion of your account, and opt out of certain communications."
- California Residents: "If you are a California resident, you may have rights under the California Consumer Privacy Act (CCPA/CPRA), including the right to know what personal information we collect, request deletion of personal information, and not be discriminated against for exercising your rights."
- Changes to This Privacy Policy: "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of the PulseOne website after changes become effective constitutes acceptance of the revised policy."
- Contact Us: "If you have questions or concerns about this Privacy Policy or our data practices, contact PulseOne at support@pulseone.com."

`frontend/src/app/privacy/page.tsx`:

- metadata title `{ absolute: "Privacy Policy | PulseOne" }`, description of one sentence from the intro, canonical `/privacy`
- `GlobalHeader`, the intro, each section as `<h2>` plus paragraphs, `GlobalFooter`
- Same page chrome as `/contact`

In `frontend/src/components/GlobalFooter.tsx`:

- Replace the Client Login `href="#"` with `https://na.myconnectwise.net/support/index.htm?Company=PULSEONE` (external `<a>`, `rel="noopener noreferrer"`).
- Replace the Privacy Policy `href="#"` with `<Link href="/privacy">`.

In `sitemap.ts`, add `{ path: "/privacy", priority: 0.3, changeFrequency: "yearly" }`.

- [ ] **Step 4: Re-run the test**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/privacyPolicy.test.ts'`

Expected: PASS.

---

### Task 5: Noindex switch for non-production hosts

**Files:**
- Create: `frontend/src/lib/indexing.ts`
- Create: `frontend/src/lib/indexing.test.ts`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/robots.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_ROBOTS_INDEX`.
- Produces: `indexingEnabled(): boolean`, true unless the variable is the string `"false"`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/indexing.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { indexingEnabled } from "./indexing";

describe("indexingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("indexes unless the flag is exactly false", () => {
    vi.stubEnv("NEXT_PUBLIC_ROBOTS_INDEX", "");
    expect(indexingEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ROBOTS_INDEX", "false");
    expect(indexingEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm failure**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/indexing.test.ts'`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the flag**

```ts
// frontend/src/lib/indexing.ts
export function indexingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ROBOTS_INDEX !== "false";
}
```

In `frontend/src/app/layout.tsx`, set `robots` from `indexingEnabled()`:

- enabled: keep the current `{ index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }`
- disabled: `{ index: false, follow: false }`

In `frontend/src/app/robots.ts`, when indexing is disabled return a single rule `{ userAgent: "*", disallow: "/" }` and omit `sitemap` and `host`. When enabled, keep the current rules.

In `.env.example`, next to `NEXT_PUBLIC_SITE_URL`, add:

```
# Set to false on staging or any public host that is not the live pulseone.com cutover.
# Production cutover leaves this unset (indexing on). Rebuild the frontend after changing it.
# NEXT_PUBLIC_ROBOTS_INDEX=false
```

Do not set the variable in `docker-compose.yml`. Localhost is not a public host.

- [ ] **Step 4: Re-run the test**

Run: `docker compose exec -T frontend sh -lc 'npx vitest run src/lib/indexing.test.ts src/lib/legacyRedirects.test.ts src/lib/locations.test.ts src/lib/privacyPolicy.test.ts src/lib/site.test.ts'`

Expected: PASS.

Railway staging: set `NEXT_PUBLIC_ROBOTS_INDEX=false` in the frontend service and redeploy. That is an environment change, not a repo change. Do it before the staging URL is public. Leave production unset until the cutover deploy, and in that same deploy set `NEXT_PUBLIC_SITE_URL=https://pulseone.com`.

---

## Out of scope until a later plan

Do not start DNS cutover when this plan is done. These still have to happen first:

- A redirect map for the 82 WordPress posts at the apex (Tech Talk and the rest), onto the matching HubSpot URL when one exists.
- Search Console coverage export, then a check that every indexed URL is either in `LEGACY_REDIRECTS` or on the accepted-drop list below.
- Accepted drops, left as 404s after cutover: `/thrive`, `/thrive-login`, `/thrive-registration`, `/thrive-special-access`, `/courses`, `/profile`, `/profile-2`, `/profile-3`, `/reset-password`, `/reset-password-2`, `/registration-2`, `/grow-with-confidence`, `/hubspot-blog-post-test`, `/framework_process`, `/appointment-confirmation`, `/upcoming-events`.

## Self-review

- Spec coverage: title, redirects, city pages, privacy, staging noindex, blog host left alone, posts deferred, DNS deferred. Each has a task or an explicit out-of-scope gate.
- Placeholder scan: privacy body text is specified by heading list plus the three sentences the test locks. The page component follows the contact/service chrome already in the repo rather than a second design.
- Type consistency: `LEGACY_REDIRECTS`, `LOCATIONS`, `getLocation`, `locationPath`, `PRIVACY_PATH`, `PRIVACY_SECTIONS`, `indexingEnabled`, `HOME_TITLE`, `HOME_DESCRIPTION` are the names used in every task.
