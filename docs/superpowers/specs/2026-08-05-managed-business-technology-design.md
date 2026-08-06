# Managed Business Technology — service page redesign

**Date:** 2026-08-05
**Status:** Approved for implementation
**Replaces:** the `managed-it-services` service entry (Managed and Co-Managed IT Services)

## Why

The Managed IT Services page sold day-to-day operations: help desk, monitoring, patching, backups.
That work continues, but it no longer describes where PulseOne is going or where small and mid-market
organizations are heading. The page is repositioned around technology adoption, performance,
optimization, and integration, and it becomes the home for **ongoing management** of security, data,
agentic tools, and the policies governing them — the beginning of managing agentic tooling as a
service rather than rolling it out once.

## Naming decision

The service line is **Managed Business Technology**.

"Managed Business Services" was considered and rejected: it reads as business-process outsourcing
(payroll, bookkeeping, HR), which contradicts the out-of-scope list in
`backend/content/pulseone-identity.md`, and it drops the search intent carried by "managed" plus
"technology."

| Field | Value |
| --- | --- |
| `slug` | `managed-business-technology` |
| `navLabel` | Managed Business Technology |
| `name` | Managed Business Technology Services |
| `serviceType` | Managed business technology services |
| `eyebrow` | Managed Services |

`/services/managed-it-services` returns a permanent redirect to the new path.

## Relationship to the AI & Emerging Tech page

The two pages split by lifecycle, not by subject:

- **AI & Emerging Tech** (`ai-and-emerging-tech`) — selecting, configuring, and rolling out agentic
  tools and automation. Project work with a defined end.
- **Managed Business Technology** — ongoing ownership of what is now in production: access
  boundaries maintained, review steps enforced, monitoring, change control as vendors and models
  shift, and the written policy behind it.

The AI & Emerging Tech boundary gains one sentence pointing ongoing management here, so the two
pages do not compete for the same query.

## Page content

### Hero

- Headline: **Not just kept running.** Accent: *Kept improving.*
- Lede: uptime is the starting condition; the value is in what the systems do next — adopted
  properly, connected, tuned, and governed.

### Intro (answer-first)

1. A definition sentence: managed business technology means PulseOne takes ongoing ownership of the
   systems the business runs on and the work of improving them — adoption, tuning, integration, and
   governance of data and agentic tools. Stability is included as the starting condition rather than
   sold as the deliverable.
2. The situation paragraph: most organizations cannot name a performance problem. They have a dozen
   platforms bought at different times, staff working around the gaps, and agentic tools arriving
   before anyone decided what those tools may touch.

### Capabilities

Six pillars plus one deliberately demoted entry:

1. Technology adoption, managed
2. Performance and optimization
3. Integration between systems
4. Data management
5. Agentic tool management
6. Policy management
7. Day-to-day operations, included — help desk, monitoring, patching, backups; stated plainly as
   necessary and not where the value is

### Industry section (new page region)

`ServiceContent` gains an **optional** `industryFocus` field:

```ts
type ServiceIndustryFocus = {
  heading: string;
  intro: string;
  items: { industry: string; body: string }[];
};
```

The `[slug]` template renders this section only when a service defines it, so the other four service
pages are unchanged. Managed Business Technology defines four items — Healthcare, Financial
Services, Manufacturing, Legal & Professional Services — each describing how security, data
management, agentic tooling, and policy differ in that setting. The section links to `/industries`.

### Boundary

PulseOne manages the technology layer: platforms, data, integrations, agentic tools, and the
policies governing them. Out of scope, stated on the page: training foundation models; running HR,
finance, marketing, or general business operations; installing or commissioning production
equipment.

### FAQ

Four entries, 40–80 words each, opening with a complete sentence per the existing convention:

1. What is managed business technology?
2. How is this different from managed IT?
3. What does managing agentic tools day to day involve?
4. Does this replace the systems we already run?

## Files changed

| File | Change |
| --- | --- |
| `frontend/src/lib/services.ts` | Rewrite the service entry; add optional `industryFocus` type; one-line boundary edit on `ai-and-emerging-tech` |
| `frontend/src/app/services/[slug]/page.tsx` | Render `industryFocus` when present |
| `frontend/next.config.ts` | Permanent redirect `managed-it-services` → `managed-business-technology` |
| `frontend/src/app/services/page.tsx` | Hub meta description reflects the new service line |
| `frontend/public/llms.txt` | Updated service listing and path |
| `backend/content/pulseone-identity.md` | In-scope list gains ongoing data, agentic tool, and policy management |
| `frontend/src/lib/services.test.ts` | New: content invariants and redirect-collision guard |

`frontend/src/app/sitemap.ts` derives entries from `SERVICES`, so the new path propagates without an
edit.

## Testing

New `frontend/src/lib/services.test.ts` asserts:

- every service has a unique slug, and `managed-it-services` is no longer a live slug (it must stay a
  redirect source only)
- `getService("managed-business-technology")` resolves and carries an `industryFocus` with at least
  one item
- `industryFocus` remains absent on the other services, proving the template addition is opt-in

Run `npm run lint` and `npm run test` in the frontend container before opening the PR.
