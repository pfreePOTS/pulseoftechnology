/**
 * Illustrative PulseOne engagement narratives for `/recommended-path`.
 * Replace later with content from an admin-backed knowledgebase or CMS —
 * shape is intentionally stable (`id`, `title`, teaser, sections).
 *
 * Visuals map from `id` → SVG icons (see `CaseStudyHeroIcon.tsx`) — no per-URL raster art.
 * For industry-tailored narratives, vary copy/teaser via CMS fields; optionally add an
 * `iconKey`/`motif` field later if you need more than three patterns without new images.
 */
export type RecommendedCaseStudy = {
  id: string;
  title: string;
  teaser: string;
  approach: string;
  solution: string;
  howWeHelped: string;
};

export const RECOMMENDED_PATH_CASE_STUDIES: RecommendedCaseStudy[] = [
  {
    id: "ops-ai-sequencing",
    title: "Sequencing AI pilots without disrupting core operations",
    teaser:
      "Regional operations leader aligning fleet, ERP, and new AI-assisted workflows across distributed sites.",
    approach:
      "We ran a disciplined discovery with ops, IT, and finance on the same cadence — mapping where AI tooling would attach to workflows vs. where it would duplicate fragile manual processes. Adoption states and decision rights were made explicit before any vendor demos.",
    solution:
      "A phased roadmap: stabilize data lineage and integrations for two priority lanes first, paired executive scorecards on pilot KPIs and rollback triggers, then a wider rollout pattern other sites could replicate without reinventing governance each time.",
    howWeHelped:
      "PulseOne facilitated cross-functional prioritization, moderated vendor-neutral proof-of-value exercises, and left the organisation with sequencing documents and RACI-aligned controls their audit partner could trace.",
  },
  {
    id: "governance-sprint",
    title: "30-day posture & policy sprint ahead of insurer scrutiny",
    teaser:
      "Mid-market CFO and CISO under pressure to show defensible narratives before renewal season.",
    approach:
      "We compressed stakeholder interviews into a single evidence trail — tying existing tooling, logging, and contractual commitments to the risk story underwriters actually ask for. No boilerplate binder; every control mapped to a named owner.",
    solution:
      "A board-ready annex of posture statements, phased remediation where gaps were material, and a lightweight quarterly review rhythm so posture updates without another hero project.",
    howWeHelped:
      "We drafted defensible narratives in leadership language, stress-tested them with tabletop scenarios, and stayed on-call during carrier Q&A so technical detail matched financial projections.",
  },
  {
    id: "fractional-office",
    title: "Standing up a fractional technology office for scaling leadership",
    teaser:
      "Fast-growing organisation outgrowing ad hoc IT decisions — needed steady governance without hiring a full bench.",
    approach:
      "We anchored on business outcomes first: recurring revenue continuity, resilience during platform changes, and clarity on capex vs opex envelopes. Operating cadences (monthly/quarterly) were agreed before structuring any standing meetings.",
    solution:
      "A lightweight office model: RACI-aligned intake for initiatives, evergreen vendor scorecards, and an escalation ladder that routed exceptions without bypassing procurement or architecture review.",
    howWeHelped:
      "PulseOne embedded alongside existing PMO and vendor teams — coaching internal leads, tightening documentation templates, and sunsetting rituals that duplicated effort once the rhythms stuck.",
  },
];
