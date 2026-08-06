import { canonicalIndustryLabel, type IndustryOption } from "@/lib/industryGrid";

/**
 * Illustrative PulseOne engagement narratives for `/recommended-path`.
 * Composites, not named clients, with sector-specific framing and stable `id`s
 * for icons (see `CaseStudyHeroIcon.tsx`).
 *
 * Scope: IT and technology integration only (advisory, security, cloud, MSP,
 * integration, phones, websites), not operational equipment install (robotics,
 * packaging, production machinery); networking/security for those assets is OK.
 * AI-generated cards follow `backend/content/pulseone-identity.md` + path synthesis prompts.
 */
export type RecommendedCaseStudy = {
  id: string;
  title: string;
  /** Optional short teaser; card front prefers `problem`, `who`, `provided` when present. */
  teaser?: string;
  /** Plain-language card fronts (recommended). */
  problem?: string;
  who?: string;
  /** What PulseOne supplied or operates. */
  provided?: string;
  approach: string;
  solution: string;
  howWeHelped: string;
};

/** Default when industry is omitted, “Other”, or unrecognized. */
export const RECOMMENDED_PATH_CASE_STUDIES_DEFAULT: RecommendedCaseStudy[] = [
  {
    id: "ops-ai-sequencing",
    title: "Rolling out agentic tools without disrupting day-to-day operations",
    problem: "Rolling out agentic tools without disrupting day-to-day operations",
    who: "Regional operations leaders streamlining core workflows and agent-assisted tools across many sites",
    provided:
      "A phased rollout: priority integrations first, executive scorecards with rollback triggers, then a pattern other sites could reuse",
    teaser:
      "Regional operations leader aligning core systems, workflows, and agent-assisted tools across distributed sites.",
    approach:
      "We would map which workflows can tolerate automation and which need a person in the loop, with decision rights clear before vendor demos.",
    solution:
      "A typical engagement phases two priority integration lanes first, adds executive scorecards with rollback triggers, then a reusable pattern for additional sites.",
    howWeHelped:
      "PulseOne would facilitate prioritization across operations, finance, and IT, run neutral proof exercises, and document sequencing owners auditors can follow.",
  },
  {
    id: "governance-sprint",
    title: "30-day security and readiness sprint before stakeholder scrutiny",
    problem: "30-day security and readiness sprint before stakeholder scrutiny",
    who: "Leadership pairing financial and security narratives under tight renewal deadlines",
    provided:
      "Board-ready summary of posture claims, phased fixes where it mattered, and a quarterly refresh rhythm",
    teaser:
      "Leadership pairing financial and cyber narratives under tight renewal deadlines.",
    approach:
      "We would pull stakeholder input into one evidence trail, tools, logs, and contracts mapped to risks partners actually ask about, with a named owner per claim.",
    solution:
      "You could expect a board-ready posture summary, phased remediation where it matters, and a quarterly refresh cadence instead of hero rescues.",
    howWeHelped:
      "PulseOne would draft leadership-ready narratives and stress-test them with tabletops and Q&A rehearsals so numbers match commitments.",
  },
  {
    id: "fractional-office",
    title: "Steady technology leadership without building a full executive bench",
    problem: "Steady technology leadership without building a full executive bench",
    who: "Organizations outgrowing ad hoc IT escalations that need steady rhythms without hiring a full C-suite technology team",
    provided:
      "A lightweight office model: clear intake, vendor scorecards, and escalation paths that respect procurement and architecture",
    teaser:
      "Organization outgrowing ad hoc IT escalations needing steady rhythms without staffing a full C-suite bench.",
    approach:
      "We would anchor cadence on revenue continuity, resilience through platform change, and clear capital and operating guardrails, meetings follow outcomes.",
    solution:
      "A typical model includes clear intake owners, evergreen vendor scorecards, and escalation routes that respect procurement and architecture.",
    howWeHelped:
      "PulseOne would work alongside program management and partners, tighten templates, and retire duplicate rituals once rhythms hold.",
  },
];

/** Three engagement patterns × industry, IDs align with hero icons/panels only. */
const BY_INDUSTRY: Record<IndustryOption, RecommendedCaseStudy[]> = {
  Healthcare: [
    {
      id: "ops-ai-sequencing",
      title: "Clinical-facing AI sandbox without weakening EHR trust",
      teaser:
        "Digital health VP piloting ambient documentation and care-path assist, balanced against HIPAA-grade logging and clinician change fatigue (illustrative example).",
      approach:
        "We separated ‘safe experimentation’ wards from billing-critical integrations, mapped PHI flows end-to-end, and required human attestation checkpoints before widening model scope.",
      solution:
        "Dual-track roadmap: hardened interfaces and audit trails for pilots on two service lines first, KPIs spanning quality and burnout, rollback criteria tied to safety events not vendor timelines.",
      howWeHelped:
        "Chaired clinician–IT prioritization forums, scripted vendor-neutral POCs, and aligned documentation insurers and compliance could follow without rewriting the charter each quarter.",
    },
    {
      id: "governance-sprint",
      title: "Ransomware and BAA-ready narrative before payer reviews",
      teaser:
        "CISO + CFO pressured to unify cyber recovery and HIPAA business-associate attestations ahead of contracting season (illustrative example).",
      approach:
        "Tabletop-derived incident stories replaced slide-deck generics; immutable backup posture and identity blast-radius were spelled in contract language reviewers expect.",
      solution:
        "Single executive brief linking clinical continuity hours, escrowed recovery paths, and explicit BA obligations — plus a 90-day gap plan where scans showed exposure.",
      howWeHelped:
        "Ran cross-functional rehearsals, reconciled MSSP scope with enterprise reality, coached leadership Q&A until numbers matched runbooks.",
    },
    {
      id: "fractional-office",
      title: "Interim governance across hospitals absorbing new platforms",
      teaser:
        "Multi-site rollout of EHR modules and RPM vendors, portfolios competing for the same analyst hours (illustrative example).",
      approach:
        "Defined decision rights among CMIO, revenue cycle, and IT so intake didn’t bottleneck on one hero PM; vendor scorecards favored integration debt reduction.",
      solution:
        "Rolling 13-week runway with capped parallel initiatives per region, escalation ladder for interoperability exceptions, KPIs tying adoption to clinician hours saved.",
      howWeHelped:
        "Embedded with transformation PMO to kill duplicate meetings, tighten steering packets, transfer ownership before our exit milestone.",
    },
  ],
  "Financial Services": [
    {
      id: "ops-ai-sequencing",
      title: "Payments modernization with AI copilots gated on fraud tolerance",
      teaser:
        "COO aligning ISO 20022, legacy wire platforms, and document AI for ops teams.",
      approach:
        "Modeled latency and anomaly thresholds before procurement; segregation-of-duties for model changes mirrored existing wire-release controls.",
      solution:
        "Phased cutover playbook: two corridors with hardened observability, exec dashboards on exceptions and rollback SLAs, then templated rollout to additional rails.",
      howWeHelped:
        "Mediated ops–risk debates, audited vendor claims against production traces, authored board paragraphs finance could defend.",
    },
    {
      id: "governance-sprint",
      title: "Regulator-ready third-party and cloud posture in a compressed window",
      teaser:
        "Mid-size institution facing examiner questions on critical outsourcers and tenant isolation.",
      approach:
        "Mapped contractual exit rights to actual failover evidence; surfaced cloud shared-responsibility blind spots finance hadn’t modeled for capital.",
      solution:
        "90-day remediation pacing with capex overlays, RACI spanning vendor TPM and internal SOC, quarterly attestation rhythm.",
      howWeHelped:
        "Ghost-wrote examiner letters, coached LOB sponsors in plain language, kept technical debt visible on one leadership scorecard.",
    },
    {
      id: "fractional-office",
      title: "Operating model through M&A carve-out tech separation",
      teaser:
        "Acquirer standing up transitional services while peeling shared infrastructure.",
      approach:
        "Prioritized TSA exit risks (identity, treasury connectivity) over feature parity; staffed governance for decisions that legally couldn’t drift.",
      solution:
        "TSO dashboards with CIO/CFO milestones, hardened integration factory pattern for remaining tuck-ins.",
      howWeHelped:
        "Sat in integration office hours, mediated infrastructure vs compliance trade-offs, left reusable decision logs.",
    },
  ],
  Technology: [
    {
      id: "ops-ai-sequencing",
      title: "Product-led AI rollout with customer-trust thresholds",
      teaser:
        "SaaS scale-up layering copilots into support and success workflows without surprise billing or SLA breaches.",
      approach:
        "Defined ‘model change’ events that merit customer notice; tied rollout waves to SOC2 controls and uptime budgets already promised in contracts.",
      solution:
        "Feature flags tied to tenancy cohorts; incident playbooks for model drift distinct from infra outages; KPIs bridging NPS with human review backlog.",
      howWeHelped:
        "Bridged founders, security, and GTM leaders; scripted beta criteria and comms reviewers could approve quickly.",
    },
    {
      id: "governance-sprint",
      title: "Board cyber narrative ahead of IPO / diligence cycle",
      teaser:
        "CISO prepping breach communications, vendor concentration, and appsec metrics for investors.",
      approach:
        "Rebuilt metrics around material incidents and remediation velocity, not vanity scan counts, with named owners per gap.",
      solution:
        "One diligence packet mapping controls to frameworks buyers asked about; phased hardening roadmap with cash impact.",
      howWeHelped:
        "Stress-tested disclosures with tabletop stories; aligned CFO capex overlays with technical milestones.",
    },
    {
      id: "fractional-office",
      title: "Engineering-led portfolio office for hyperscale hiring",
      teaser:
        "VP Eng juggling platform debt vs new SKU bets while reliability targets slip.",
      approach:
        "Converted implicit trade-offs into a weekly portfolio lane with SRE veto on launches breaching error budgets.",
      solution:
        "Canonical architecture decision records with sunset dates; vendor neutrality for observability roadmap.",
      howWeHelped:
        "Facilitated E-staff rhythms, surfaced integration tax in planning templates, coached managers on consequence framing.",
    },
  ],
  Manufacturing: [
    {
      id: "ops-ai-sequencing",
      title: "OT–IT segmentation before shop-floor automation pilots",
      teaser:
        "Plant network leader sequencing computer-vision QA and predictive maintenance without opening lateral movement paths.",
      approach:
        "Asset inventory crossing Purdue levels; choke points for DMZ crossings; patching windows reconciled with production calendars.",
      solution:
        "Two-factory pilot cadence with immutable backups at edge, escalation when variance crossed tolerances, playbook for sibling sites.",
      howWeHelped:
        "Mediated OT vendor vs IT standards; authored risk language for insurer renewals tying to containment tests.",
    },
    {
      id: "governance-sprint",
      title: "Supply-chain cyber narrative for insurer and Tier-1 audits",
      teaser:
        "CISO pressured after partner incidents, need defensible segmentation and MFA evidence fast.",
      approach:
        "Incident timelines tied to MFA coverage and logging retention — not hypotheticals; supplier tiering grounded in BOM criticality.",
      solution:
        "90-day prioritized controls roadmap with capex tied to uptime SLAs owed to marquee customers.",
      howWeHelped:
        "Led joint sessions with procurement and OT leads; tabletop for supplier ransomware with finance outcomes.",
    },
    {
      id: "fractional-office",
      title: "Digital-thread governance across plants and HQ",
      teaser:
        "VP Ops harmonizing MES rollouts competing with ERP upgrade waves.",
      approach:
        "Single architectural board for integrations consuming historian data; RACI bridging plant managers and corp IT.",
      solution:
        "Quarterly capex-aligned initiative portfolio; vendor scorecards weighting interoperability over feature lists.",
      howWeHelped:
        "Ran steering forums, tightened business cases to OT constraints, phased duplicate PM structures out.",
    },
  ],
  Energy: [
    {
      id: "ops-ai-sequencing",
      title: "Grid-edge analytics pilots with reliability guardrails",
      teaser:
        "VP Operations coupling IoT ingestion and outage prediction, without destabilizing SCADA-aligned change windows (illustrative example).",
      approach:
        "Segmented experimentation from bulk electric system controls; clarified what ‘AI assist’ meant for human operators under NERC-style discipline.",
      solution:
        "Two-regional pilot bounded by failover drills, KPIs tying model alerts to dispatcher workload, phased expansion only after tabletop sign-off.",
      howWeHelped:
        "Facilitated OT–enterprise IT mediation; authored risk packets leadership could explain to regulators and insurers uniformly.",
    },
    {
      id: "governance-sprint",
      title: "Cyber–physical tabletop tied to capex remediation",
      teaser:
        "Board asking for ransomware and vendor concentration evidence after sector headlines.",
      approach:
        "Storylines referenced actual choke points, remote access paths, patching exceptions, immutable backup coverage — mapped to dollarized outage durations.",
      solution:
        "Narratives plus 120-day prioritized program with outage-hour assumptions finance validated.",
      howWeHelped:
        "Scenario design with operations leaders; liaison for insurer renewal Q&A aligning with remediation truth.",
    },
    {
      id: "fractional-office",
      title: "Portfolio office for renewables + legacy asset IT",
      teaser:
        "CIO juggling greenfield telemetry platforms with aging DCS integrations.",
      approach:
        "Single intake for capex-heavy initiatives; escalation when shared network segments risked cascading trips.",
      solution:
        "Quarterly roadmap with capacity model for integrations; vendor neutrality rules for telemetry stacks.",
      howWeHelped:
        "Ran executive forums bridging generation vs trading stakeholders; tightened business cases to reliability metrics.",
    },
  ],
  Retail: [
    {
      id: "ops-ai-sequencing",
      title: "Store and e-com AI without loyalty or pricing surprises",
      teaser:
        "CX lead piloting personalization and inventory copilots while PCI scope stays bounded.",
      approach:
        "Separated training data domains; human review for interventions affecting margin or substitutions that touch PCI flows.",
      solution:
        "Wave pilots in two banners with anomaly budgets, rollback hooks to manual merchandising lanes, repeatable kit for franchises.",
      howWeHelped:
        "Aligned marketing, LP, and IT on guardrails; vendor-neutral POC scripts protecting brand promises.",
    },
    {
      id: "governance-sprint",
      title: "Breach-ready comms before peak season scrutiny",
      teaser:
        "CISO pairing payment terminal posture with ransomware recovery ahead of audits.",
      approach:
        "Terminal estate truth vs paper policies; MFA and logging proofs store managers could corroborate during incidents.",
      solution:
        "Executive brief tying hour-of-sales impact estimates to control investments; phased patches around peak freezes.",
      howWeHelped:
        "Retail-hour tabletops with finance outcomes; coached CEO talking points bridging tech and comps narrative.",
    },
    {
      id: "fractional-office",
      title: "Unified digital runway across stores and 3PL",
      teaser:
        "COO converging omnichannel promises with brittle WMS integrations.",
      approach:
        "Lane-based portfolio: customer-facing launches vs foundational integration debt with explicit deferrals.",
      solution:
        "13-week horizons with SLA bridges to logistics partners; scorecards emphasizing inventory truth over feature velocity.",
      howWeHelped:
        "Governance cadence bridging merchants and ops; killed duplicate tiger teams competing for ERP bandwidth.",
    },
  ],
  Government: [
    {
      id: "ops-ai-sequencing",
      title: "Responsible automation for constituent services",
      teaser:
        "Agency CTO piloting NLP triage across call centers, within accessibility and records rules.",
      approach:
        "Human escalation paths audited; bilingual coverage and ADA considerations baked into rollout gates.",
      solution:
        "Two-program pilot framework with KPIs spanning wait time and appeal fairness; expansion gated on oversight review packs.",
      howWeHelped:
        "Bridged civil service and vendor teams; moderated demos so procurement scored outcomes not slide polish.",
    },
    {
      id: "governance-sprint",
      title: "Zero-trust storyline for legislators and auditors",
      teaser:
        "CIO needing jargon-free ransomware and MFA coverage summaries before hearings.",
      approach:
        "Converted technical controls into service disruption narratives residents would recognize.",
      solution:
        "90-day prioritization bridging legacy apps with compensating pathways; RACI tying agencies and shared services.",
      howWeHelped:
        "Drafted briefings in plain language; rehearsed continuity assumptions with IG-style pushback modeled.",
    },
    {
      id: "fractional-office",
      title: "Portfolio governance across bureaus and shared infrastructure",
      teaser:
        "Secretariat-level tensions on cloud migration vs on-prem mandates.",
      approach:
        "Outcome-first lanes: sovereignty, interoperability, citizen UX, not vendor religious wars.",
      solution:
        "Monthly investment board packets with capped parallel migrations; escalation for cross-cutting identity decisions.",
      howWeHelped:
        "Neutral facilitation; templated submissions so smaller bureaus didn’t bottleneck central IT.",
    },
  ],
  Education: [
    {
      id: "ops-ai-sequencing",
      title: "Remote offices were stuck in the ticket queue.",
      problem: "Branch campuses waited too long on fixes; escalation paths differed site by site.",
      who: "CFO-backed IT lead for a multi-site college system.",
      provided: "One help desk model, routing rules, and remote hands aligned to school hours.",
      approach:
        "We mapped intake channels, SLA expectations by site size, and which issues stay local versus central — before changing tools.",
      solution:
        "Shared queue, playbook for common endpoints, after-hours bridge for outages, metrics the CFO sees monthly.",
      howWeHelped:
        "Ran the cutover with your team; trained site liaisons; left runbooks so you could scale without reopening turf battles.",
    },
    {
      id: "governance-sprint",
      title: "Microsoft licensing and audits were opaque to finance.",
      problem: "True-up risk and SaaS sprawl meant renewal numbers did not match how staff actually worked.",
      who: "CFO plus IT procurement for an education nonprofit.",
      provided: "Entitlement baseline, reclaim path, and contract language checklist for renewals.",
      approach:
        "Inventory matched to HR and SSO reality, not spreadsheets from three years ago.",
      solution:
        "Sized subs by role cohort, phased reclamation, dashboards finance could defend in budget cycles.",
      howWeHelped:
        "Sat with procurement and academics so cuts did not strand classrooms; mediated vendor conversations without locking you into SKU sprawl.",
    },
    {
      id: "fractional-office",
      title: "A network refresh overlapped classroom go-live.",
      problem: "Two initiatives shared the same change windows, outage risk during term.",
      who: "CIO program office and facilities.",
      provided: "Single PM-led schedule with executive readouts and cutover rehearsals.",
      approach:
        "Dependencies written in calendar terms leadership understood — not Gantt jargon.",
      solution:
        "Frozen windows during exams, parallel paths where safe, rollback tested once per building.",
      howWeHelped:
        "Chaired weekly triage until both tracks landed; transferred ownership before we stepped back.",
    },
  ],
  Telecommunications: [
    {
      id: "ops-ai-sequencing",
      title: "Network automation pilots with outage-hour budgets",
      teaser:
        "VP Engineering layering closed-loop remediation on OSS cautiously.",
      approach:
        "Defined blast-radius caps per pilot region; rollback automation tested before AI-suggested remediations touched production routers.",
      solution:
        "Two-market pilots with KPIs bridging MTTR reduction and dispatcher trust; playbook for adjoining regions.",
      howWeHelped:
        "Mediated NOC and platform leaders; neutrality in vendor bake-offs stressing observability interoperability.",
    },
    {
      id: "governance-sprint",
      title: "Supply-chain and submarine cable concentration narrative",
      teaser:
        "Board-level vendor risk story before infrastructure renewal financings.",
      approach:
        "Quantified choke points, not slide buzzwords, and tied compensating detective controls audit could trace.",
      solution:
        "90-day roadmap balancing diversity of paths vs capital; quarterly Board digest in non-engineering English.",
      howWeHelped:
        "Ran scenario drills with treasury; coached CFO overlays on uninsured outage modeling.",
    },
    {
      id: "fractional-office",
      title: "Portfolio office for 5G edge + enterprise product bets",
      teaser:
        "CIO juggling consumer edge rollout with B2B private-network promises.",
      approach:
        "Outcome lanes separating regulated telco stacks from experimental enterprise SKUs; explicit deferrals documented.",
      solution:
        "Executive scorecards aligning capex envelopes to attach-rate milestones; RACI bridging network and IT.",
      howWeHelped:
        "Facilitated contentious prioritization forums; tightened business cases tying spend to EBITDA guardrails.",
    },
  ],
  Transportation: [
    {
      id: "ops-ai-sequencing",
      title: "Dispatch and predictive maintenance AI with safety thresholds",
      teaser:
        "COO piloting predictive parts and routing assist without bypassing conductor or driver authority.",
      approach:
        "Separated advisory vs automated actuation lanes; fatigue-sensitive workflows flagged for mandatory human checkpoints.",
      solution:
        "Two-hub pilots with KPIs on delay minutes and rework; expansion gated on regulator-style readiness drills.",
      howWeHelped:
        "Bridged ops, unions where applicable, and IT; scripted vendor neutrality around telemetry provenance.",
    },
    {
      id: "governance-sprint",
      title: "Cyber tabletop tied to kinetic service disruption financing",
      teaser:
        "CFO + CISO asked to brief insurers after sector ransomware headlines.",
      approach:
        "Incident simulations priced in outage hours lost revenue and SLA penalties, not generic likelihood heat maps.",
      solution:
        "Program roadmap with prioritized controls aligned to underwriting questionnaires and capital overlays.",
      howWeHelped:
        "Ran cross-disciplinary rehearsals; coached leadership Q&A aligning technical truth with disclosures.",
    },
    {
      id: "fractional-office",
      title: "Fleet systems governance across hubs and outsourced maintenance",
      teaser:
        "VP Ops harmonizing TMS, maintenance SaaS, and ERP without duplicate PM spikes.",
      approach:
        "Single initiative intake with modality-specific swim lanes and explicit capacity model for integrators.",
      solution:
        "Quarterly portfolio views with SLA bridges to 3PLs; escalation path for interoperability exceptions.",
      howWeHelped:
        "Neutral chair in steering rituals; tightened templates so hubs didn’t each customize governance.",
    },
  ],
  "Media & Entertainment": [
    {
      id: "ops-ai-sequencing",
      title: "Production and distribution AI respecting rights metadata",
      teaser:
        "CTO piloting generative tooling in marketing and localization without drifting rights lineage.",
      approach:
        "Rights and talent constraints encoded before model scope expanded; watermarking/parentage surfaced to legal early.",
      solution:
        "Two-title pilot runway with KPIs on cycle time vs claims risk; playbook for franchises and international cuts.",
      howWeHelped:
        "Bridged creative, legal ops, and ML platform teams; scripted vendor neutrality in bake-offs.",
    },
    {
      id: "governance-sprint",
      title: "Ransomware and piracy tabletop before tentpole release",
      teaser:
        "Studio CISO prepping incident comms aligning cyber with PR and financier covenants.",
      approach:
        "Scenarios anchored on blackout windows impacting opening-weekend SLA assumptions.",
      solution:
        "90-day prioritized uplift on identity, backup immutability, and partner egress paths with capex overlays.",
      howWeHelped:
        "Ran tabletop with distribution partners; coached leadership talking points aligning cash with controls.",
    },
    {
      id: "fractional-office",
      title: "Portfolio office across streaming stacks and theatrical systems",
      teaser:
        "CIO harmonizing personalization roadmaps with DRM and billing migrations.",
      approach:
        "Explicit deferral log so marketing experiments didn’t starve foundational identity work.",
      solution:
        "Rolling quarters with SLA bridges between product, IT, and ad-tech partners.",
      howWeHelped:
        "Facilitated E-staff trade-off sessions; tightened investment packets for board clarity.",
    },
  ],
  "Real Estate": [
    {
      id: "ops-ai-sequencing",
      title: "Leasing analytics and concierge AI bounded by tenant privacy",
      teaser:
        "COO layering AI-guided tours and underwriting assist without violating fair-housing workflows.",
      approach:
        "Human review checkpoints for pricing or screening suggestions; minimized cross-property data bleed.",
      solution:
        "Pilot across two portfolios with KPIs bridging lease velocity with complaint risk; playbook for JV partners.",
      howWeHelped:
        "Bridged ops, counsel, IT; scripted vendor neutrality and bias testing expectations.",
    },
    {
      id: "governance-sprint",
      title: "CRE cyber narrative tying building systems to ransomware recovery",
      teaser:
        "CISO briefing investors on smart-building exposure and ransomware playbooks.",
      approach:
        "BMS segmentation stories tied to hours of outage per asset class, not generic ICS slides.",
      solution:
        "Phased MFA, network segmentation roadmap with capex aligned to refinancing milestones.",
      howWeHelped:
        "Facility + IT joint tabletops with finance overlays; liaison for insurer questionnaires.",
    },
    {
      id: "fractional-office",
      title: "Digital programs across development, ops, and property managers",
      teaser:
        "CIO juggling CMMS modernization with tenant experience launches.",
      approach:
        "Outcome lanes distinguishing revenue-facing vs resilience foundations; RACI bridging PM firms.",
      solution:
        "Quarterly scorecards aligning vendor interoperability; escalation for SSO and access sprawl.",
      howWeHelped:
        "Ran steering forums consolidating duplicate vendor reviews from regional PMOs.",
    },
  ],
  Agriculture: [
    {
      id: "ops-ai-sequencing",
      title: "Edge sensing and agronomy AI with harvest-season constraints",
      teaser:
        "COO sequencing computer vision labs and predictive irrigation without disrupting cooperatives.",
      approach:
        "Data governance for grower anonymity; rollout windows synced with agronomy calendars not vendor quarters.",
      solution:
        "Two-region pilots with KPIs bridging yield variability and agronomist hours; replication kit for growers.",
      howWeHelped:
        "Bridged coop leadership, agronomists, IT; neutrality in agritech POC design.",
    },
    {
      id: "governance-sprint",
      title: "Climate and ransomware narrative ahead of coop financing",
      teaser:
        "CFO + CTO needing coherent story linking OT exposure and ERP continuity.",
      approach:
        "Tabletops priced revenue-at-risk tied to elevators, dryers, irrigation controllers, not abstract heat maps.",
      solution:
        "Remediation pacing with overlays on crop insurance narratives leadership could defend.",
      howWeHelped:
        "Ran cross-disciplinary rehearsal; coached disclosure-friendly language aligning technical truth.",
    },
    {
      id: "fractional-office",
      title: "Portfolio office aligning precision programs and ERP",
      teaser:
        "CIO juggling seed/product traceability mandates with modernization debt.",
      approach:
        "Executive intake prioritized food-safety interoperability over experimental analytics.",
      solution:
        "Quarterly horizons with vendor scorecards on integration tax; RACI bridging field ops and corp IT.",
      howWeHelped:
        "Tightened business cases grounded in throughput and spoilage KPIs, not slide velocity.",
    },
  ],
  "Pharma & Biotech": [
    {
      id: "ops-ai-sequencing",
      title: "GMP-aligned AI pilots for lab ops and QA assist",
      teaser:
        "Head of Operations exploring vision or NLP assist without weakening batch-record integrity.",
      approach:
        "Validation mindset early: attestable lineage for model inputs and outputs mapped to CFR-style discipline.",
      solution:
        "Two-line pilot envelopes with KPIs bridging cycle variance and rework; expansion gated by quality sign-off packs.",
      howWeHelped:
        "Bridged QA, automation, IT, and alliance ops; scripted vendor neutrality in POC language.",
    },
    {
      id: "governance-sprint",
      title: "Ransomware tabletop tied to sterile batch continuity and filings",
      teaser:
        "CISO and CFO aligning cyber recovery narratives with payer and auditor expectations.",
      approach:
        "Scenarios centered on sterile batch interruption and clinical-trial downtime, not generic ransomware slides.",
      solution:
        "90-day uplift on segmentation, MFA, and immutable backups with capex tied to valued continuity hours.",
      howWeHelped:
        "Ran cross-functional drills and coached disclosures that marry cyber specifics with manufacturing reality.",
    },
    {
      id: "fractional-office",
      title: "Governance seams across R&D, manufacturing scale-up, and corporate IT",
      teaser:
        "CIO reconciling lab informatics programs with corp ERP modernization.",
      approach:
        "Explicit decision rights separating research agility from validated production baselines.",
      solution:
        "Quarterly portfolio spanning site transfers and tech-transfer waves; RACI aligning quality councils and IT.",
      howWeHelped:
        "Neutral chair for contentious prioritization forums; tightened business cases tying spend to throughput.",
    },
  ],
  "Legal Services": [
    {
      id: "ops-ai-sequencing",
      title: "Responsible practice AI with privilege and citation discipline",
      teaser:
        "Managing partner piloting drafting and discovery assist without blurring privilege boundaries.",
      approach:
        "Data isolation by matter; citations and mandatory human review on filings and client-visible outputs.",
      solution:
        "Two-practice cohort pilots with KPIs on leverage vs escalation rates; playbook for sibling offices.",
      howWeHelped:
        "Bridged innovation, knowledge management, conflicts, IT; defined defensibility thresholds for vendors.",
    },
    {
      id: "governance-sprint",
      title: "Breach readiness before malpractice renewals and lateral hiring pushes",
      teaser:
        "CISO and finance lead insurer-facing MFA and escrowed-backup truth ahead of questionnaires.",
      approach:
        "Endpoint and logging realities mapped, not aspirational policy binders.",
      solution:
        "90-day remediation pacing overlays leadership could sign; RACI aligning offices and outsourced SOC.",
      howWeHelped:
        "Tabletops with partnership pushback modeled; liaison for underwriting Q&A rehearsals.",
    },
    {
      id: "fractional-office",
      title: "Technology runway across PMS, client portals, and shared services",
      teaser:
        "COO juggling practice systems with modernization debt, without starving identity foundations.",
      approach:
        "Capacity models for integrations; explicit deferrals when flashy projects threatened SSO stability.",
      solution:
        "Rolling quarters with KPIs bridging realization and tech payoff; RACI bridging practice leaders and corp IT.",
      howWeHelped:
        "Neutral facilitation in partner-heavy debates; reusable templates preventing per-office bespoke governance.",
    },
  ],
  Hospitality: [
    {
      id: "ops-ai-sequencing",
      title: "Agent-assisted guest service without putting payments at risk",
      problem: "Agent-assisted guest service without putting payments at risk",
      who: "Operations leaders who need multilingual concierge and housekeeping agents without widening payment-card exposure",
      provided:
        "Phased pilots that balance revenue lift and fraud signals, with a repeatable playbook for franchise groups",
      teaser:
        "Operations leaders scaling agent-assisted guest service while keeping payment systems tightly scoped.",
      approach:
        "We would keep guest-facing trials separate from card-data paths and define when to pause or roll back before expanding scope.",
      solution:
        "A typical path runs two phased pilots with simple success measures, then a property playbook that reuses controls.",
      howWeHelped:
        "PulseOne would align brand operations, franchise partners, and IT and run neutral vendor tests tied to loyalty promises.",
    },
    {
      id: "governance-sprint",
      title: "Ransomware and outage story before refinancing and brand review",
      problem: "Ransomware and outage story before refinancing and brand review",
      who: "Security leaders who need guest-outage and ransomware narratives executives and lenders trust",
      provided:
        "Staged network separation and stronger sign-in roadmaps tied to outage targets leadership already funds",
      teaser:
        "Security and finance leaders preparing a credible outage and ransomware story before refinancing.",
      approach:
        "We would tie outage hours to numbers finance already uses and verify backup and recovery with people who run the properties.",
      solution:
        "You could expect phased network segmentation, stronger sign-in, and blackout targets linked to the capital plan.",
      howWeHelped:
        "PulseOne would run joint drills with facilities and IT and coach executive briefings grounded in store-level reality.",
    },
    {
      id: "fractional-office",
      title: "One plan across properties, reservations, and corporate systems",
      problem: "One plan across properties, reservations, and corporate systems",
      who: "Technology leaders who need hotel property tools aligned with company-wide finance and booking systems",
      provided:
        "Ongoing quarterly priorities that favor systems working together, with clear steps when sign-in or access rules drift",
      teaser:
        "Technology leaders harmonizing property systems with corporate finance and reservations.",
      approach:
        "We would maintain one initiative calendar with milestones per property type and clear owners between sites and headquarters.",
      solution:
        "Typical deliverables include quarterly scorecards that reward interoperability and escalation paths when access rules drift.",
      howWeHelped:
        "PulseOne would facilitate steering forums to retire duplicate vendor pursuits and ground technology investment in operating results.",
    },
  ],
  Nonprofit: [
    {
      id: "ops-ai-sequencing",
      title: "Constituent-facing automation anchored in stewardship ethics",
      teaser:
        "Executive exploring AI-guided intake without eroding donor trust.",
      approach:
        "Bias reviews and safeguarding volunteers before widening automated constituent outreach.",
      solution:
        "Two-program pilots with KPIs on response velocity vs reputational triggers; gated expansion on trustee readiness.",
      howWeHelped:
        "Bridged advancement, programs, operations, IT; neutrality in bake-offs centering disclosure-friendly criteria.",
    },
    {
      id: "governance-sprint",
      title: "Grant-aligned posture before attestations renew",
      teaser:
        "Finance and tech leads unifying MFA and backup proofs with questionnaires funders scrutinize.",
      approach:
        "Stories mapped to MSSP truths and MSP reach, not slide ambition.",
      solution:
        "90-day uplift with volunteer-friendly change windows plus RACI aligning program sponsors.",
      howWeHelped:
        "Trustee-accessible rehearsals; coached leadership Q&A marrying mission narratives with cyber specifics.",
    },
    {
      id: "fractional-office",
      title: "Portfolio office across federated chapters and corp systems",
      teaser:
        "CIO balancing CRM waves against workplace modernization spanning affiliates.",
      approach:
        "Outcome lanes distinguishing mission-critical continuity versus speculative analytics bets.",
      solution:
        "Capped parallel migrations each quarter with identity escalation paths bridging chapters.",
      howWeHelped:
        "Neutral chair in contentious forums; investment packets distilled for volunteer boards.",
    },
  ],
  "Defense & Aerospace": [
    {
      id: "ops-ai-sequencing",
      title: "Manufacturing telemetry AI within CMMC/export discipline",
      teaser:
        "Plant leader sequencing anomaly pilots beside export-sensitive workloads.",
      approach:
        "Lab segregation first; handling paths for controlled data surfaced before attaching plant-wide tooling.",
      solution:
        "Two-line envelopes with KPIs on defect rework and uptime; playbook passing security councils.",
      howWeHelped:
        "Mediated ES, factories, primes; scripted vendor neutrality in controlled demonstrations.",
    },
    {
      id: "governance-sprint",
      title: "Insider-threat and ransomware narrative for primes and subcontractors",
      teaser:
        "Program-security and finance leads briefing gates before milestones.",
      approach:
        "Scenarios anchored on slipped program dollars with named detective controls auditors could cite.",
      solution:
        "90-day prioritized hardening marrying CMMC expectations and capex overlays leadership signed.",
      howWeHelped:
        "Partner-inclusive tabletops with suppliers modeled; liaison for underwriting and customer security reviewers.",
    },
    {
      id: "fractional-office",
      title: "Integrated portfolio across ERP, PLM, and enclave modernization",
      teaser:
        "CIO juggling modernization waves without starving identity segregation work.",
      approach:
        "Deferral ledger so engineering experiments couldn’t silently cannibalize foundation programs.",
      solution:
        "Quarterly roadmap with RACI aligning programs, procurement, engineering services, corp IT councils.",
      howWeHelped:
        "E-staff trade-offs grounded on readiness milestones and funding profiles primes expect.",
    },
  ],
  Insurance: [
    {
      id: "ops-ai-sequencing",
      title: "Underwriting copilots with model risk and fairness checkpoints",
      teaser:
        "Chief actuarial pairing assistive workflows with examiner sensitivity on drift and disparate impact.",
      approach:
        "Mandatory human escalation on materially adverse classifications; lineage for pricing attributes spelled before widening scope.",
      solution:
        "Pilot underwriting books with KPIs bridging loss deltas vs regulatory concern triggers; template for adjoining LOBs.",
      howWeHelped:
        "Bridged actuarial, legal, CIO; scripted vendor neutrality in validation narrative.",
    },
    {
      id: "governance-sprint",
      title: "Cloud resilience narrative before reinsurance and ratings cycles",
      teaser:
        "CRO and CTO aligning failover drills with reinsurance questionnaires.",
      approach:
        "Truth on failover evidence and egress controls, not aspiration binders, priced to outage durations finance blessed.",
      solution:
        "Phased uplift map with overlays leadership could cite uniformly across ratings and board.",
      howWeHelped:
        "Joint rehearsals tying technical timelines to underwriting assumptions.",
    },
    {
      id: "fractional-office",
      title: "Core-system modernization portfolio across PAS, claims, and CX",
      teaser:
        "COO sequencing policy-admin migration beside omnichannel experience commitments.",
      approach:
        "Capacity-aware intake distinguishing revenue-critical waves from resilience foundations starving quietly.",
      solution:
        "Quarterly SLA bridges tying brokers, TPAs, CX teams, escalations for brittle integrations.",
      howWeHelped:
        "Consolidated duplicate modernization tracks through transparent steering rhythms.",
    },
  ],
  "Professional Services": [
    {
      id: "ops-ai-sequencing",
      title: "Delivery copilots with strict client-boundary partitioning",
      teaser:
        "Managing partner layering drafting and benchmarking assist without cross-client data bleed.",
      approach:
        "Tenancy partitioned by mandate; escalation when benchmarks touched ethically sensitive comps.",
      solution:
        "Two-industry pilot cohorts with KPIs bridging leverage versus rework; playbook for sibling practices.",
      howWeHelped:
        "Risk, knowledge, IT facilitation; neutrality in POC language clients could accept.",
    },
    {
      id: "governance-sprint",
      title: "Breach readiness before malpractice or PE diligence",
      teaser:
        "CISO marrying MFA proofs and escrowed backups to narratives partners will indemnify.",
      approach:
        "Compensating controls mapped to outage hours underwriters, not vanity scan KPIs.",
      solution:
        "90-day prioritized program with RACI aligning offices and outsourced SOC overlays.",
      howWeHelped:
        "Partner tabletop rehearsals and disclosure-aligned coaching lines.",
    },
    {
      id: "fractional-office",
      title: "Firm runway across practices and corp platforms",
      teaser:
        "COO juggling practice-specific platforms versus corp ERP stacks.",
      approach:
        "Outcome-first lanes distinguishing client-facing modernization from identity foundations quietly underfunded.",
      solution:
        "Quarterly capex-aligned portfolio dashboards; interoperability escalation ladders executives owned.",
      howWeHelped:
        "Neutral facilitation in partnership debates; EBITDA-grounded templates.",
    },
  ],
};

export type RecommendedPathCaseStudyIntake = {
  industry?: string | null;
  issue?: string | null;
  stage?: string | null;
};

const CASE_STUDY_IDS = ["ops-ai-sequencing", "governance-sprint", "fractional-office"] as const;
type CaseStudyId = (typeof CASE_STUDY_IDS)[number];

/** Map free-text “Other” industries to the closest canonical sector when possible. */
const FREE_TEXT_INDUSTRY_HINTS: ReadonlyArray<{ pattern: RegExp; industry: IndustryOption }> = [
  { pattern: /\b(food\s*service|restaurant|catering|hotel|lodging|resort|hospitality|qsr)\b/i, industry: "Hospitality" },
  { pattern: /\b(health\s*care|hospital|clinic|medical|provider|payer)\b/i, industry: "Healthcare" },
  { pattern: /\b(bank|finance|fintech|insurance|credit\s*union)\b/i, industry: "Financial Services" },
  { pattern: /\b(manufactur|factory|plant|industrial)\b/i, industry: "Manufacturing" },
  { pattern: /\b(retail|e-?commerce|storefront|merchant)\b/i, industry: "Retail" },
  { pattern: /\b(energy|utility|power\s*grid|oil\s*&\s*gas)\b/i, industry: "Energy" },
  { pattern: /\b(government|public\s*sector|municipal|federal)\b/i, industry: "Government" },
  { pattern: /\b(education|university|school\s*district|k-12)\b/i, industry: "Education" },
  { pattern: /\b(telecom|carrier|wireless|broadband)\b/i, industry: "Telecommunications" },
  { pattern: /\b(transport|logistics|freight|airline|rail)\b/i, industry: "Transportation" },
  { pattern: /\b(pharma|biotech|life\s*science)\b/i, industry: "Pharma & Biotech" },
  { pattern: /\b(legal|law\s*firm)\b/i, industry: "Legal Services" },
  { pattern: /\b(defense|aerospace|military)\b/i, industry: "Defense & Aerospace" },
  { pattern: /\b(software|saas|technology|tech\s*company)\b/i, industry: "Technology" },
  { pattern: /\b(real\s*estate|property\s*management|reit)\b/i, industry: "Real Estate" },
  { pattern: /\b(agricultur|farming|agtech)\b/i, industry: "Agriculture" },
  { pattern: /\b(nonprofit|ngo|charity)\b/i, industry: "Nonprofit" },
  { pattern: /\b(media|entertainment|studio|streaming)\b/i, industry: "Media & Entertainment" },
  { pattern: /\b(professional\s*services|consulting\s*firm|accounting\s*firm)\b/i, industry: "Professional Services" },
];

function inferIndustryFromFreeText(text: string): IndustryOption | null {
  const t = text.trim();
  if (!t) return null;
  for (const { pattern, industry } of FREE_TEXT_INDUSTRY_HINTS) {
    if (pattern.test(t)) return industry;
  }
  return null;
}

function resolveIndustryKey(raw?: string | null): IndustryOption | null {
  const t = raw?.trim();
  if (!t || t === "Other") return null;
  return canonicalIndustryLabel(t) ?? inferIndustryFromFreeText(t);
}

function preferredCaseStudyOrder(issue: string, stage: string): CaseStudyId[] {
  const blob = `${issue} ${stage}`.trim();
  const low = blob.toLowerCase();
  if (
    issue === "Cybersecurity" ||
    issue === "Compliance" ||
    /\b(cyber|security|compliance|risk|ransom|breach|audit|regulat|privacy|hipaa|soc\s*2)\b/i.test(low)
  ) {
    return ["governance-sprint", "ops-ai-sequencing", "fractional-office"];
  }
  if (
    issue === "AI" ||
    /\b(agentic|agents?|ml|llm|genai|copilot|automation|pilot|machine learning|generative|streamlin|scal(e|ing)|optimiz)\b/i.test(
      low,
    ) ||
    /\bai\b/i.test(low)
  ) {
    return ["ops-ai-sequencing", "governance-sprint", "fractional-office"];
  }
  if (
    issue === "Strategy" ||
    issue === "IT Management" ||
    /\b(govern|portfolio|vendor|operating model|runway|fractional|pmo|escalat)\b/i.test(low)
  ) {
    return ["fractional-office", "governance-sprint", "ops-ai-sequencing"];
  }
  if (issue === "Cloud" || /\b(cloud|infra|platform|migrate|moderniz|data\s*center)\b/i.test(low)) {
    return ["ops-ai-sequencing", "fractional-office", "governance-sprint"];
  }
  return [...CASE_STUDY_IDS];
}

function orderCaseStudies(studies: RecommendedCaseStudy[], issue: string, stage: string): RecommendedCaseStudy[] {
  const order = preferredCaseStudyOrder(issue, stage);
  const byId = new Map(studies.map((s) => [s.id, s]));
  const ordered: RecommendedCaseStudy[] = [];
  for (const id of order) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  for (const s of studies) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  return ordered;
}

/** Subheading copy for the Engagements band on `/recommended-path`. */
export function recommendedCaseStudiesIntro(intake?: RecommendedPathCaseStudyIntake | null): string {
  const industryRaw = intake?.industry?.trim() ?? "";
  const stage = intake?.stage?.trim() ?? "";
  const issue = intake?.issue?.trim() ?? "";
  const canonical = resolveIndustryKey(industryRaw);
  const sectorLabel = industryRaw || canonical || "";

  if (sectorLabel && stage) {
    const short =
      stage.length > 140 ? `${stage.slice(0, 137).trimEnd()}…` : stage;
    return `How we would approach this kind of work in ${sectorLabel}, for situations like yours: “${short}”`;
  }
  if (sectorLabel) {
    return `How we would approach this kind of work in ${sectorLabel}. These are illustrative examples, not past client stories.`;
  }
  if (stage) {
    const short =
      stage.length > 160 ? `${stage.slice(0, 157).trimEnd()}…` : stage;
    return `Illustrative examples of how we would help, grounded in what you shared: “${short}”`;
  }
  if (issue) {
    return `Illustrative examples of how we would help, aligned with your focus on ${issue}.`;
  }
  return "Illustrative examples of how we would help organisations like yours.";
}

export function recommendedCaseStudiesForIntake(
  intake?: RecommendedPathCaseStudyIntake | null,
): RecommendedCaseStudy[] {
  const industryKey = resolveIndustryKey(intake?.industry);
  const base =
    industryKey && industryKey in BY_INDUSTRY
      ? BY_INDUSTRY[industryKey]
      : RECOMMENDED_PATH_CASE_STUDIES_DEFAULT;
  return orderCaseStudies(base, intake?.issue?.trim() ?? "", intake?.stage?.trim() ?? "");
}

export function recommendedCaseStudiesForIndustry(industry?: string | null): RecommendedCaseStudy[] {
  return recommendedCaseStudiesForIntake({ industry });
}

/** @deprecated Prefer {@link recommendedCaseStudiesForIndustry}; kept for gradual import migration. */
export const RECOMMENDED_PATH_CASE_STUDIES = RECOMMENDED_PATH_CASE_STUDIES_DEFAULT;
