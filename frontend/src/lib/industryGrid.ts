/**
 * Canonical industry grid — must match `INDUSTRY_GRID_LABELS` in `backend/services/ai_service.py`
 * and admin Impact workbench columns.
 */
export const INDUSTRY_OPTIONS = [
  "Healthcare",
  "Financial Services",
  "Technology",
  "Manufacturing",
  "Energy",
  "Retail",
  "Government",
  "Education",
  "Telecommunications",
  "Transportation",
  "Media & Entertainment",
  "Real Estate",
  "Agriculture",
  "Pharma & Biotech",
  "Legal Services",
  "Hospitality",
  "Nonprofit",
  "Defense & Aerospace",
  "Insurance",
  "Professional Services",
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

const DEFAULT_HEX = "#6B7280";

/** Colours for legend, filters, and canonical topic keys */
const CANONICAL: Record<IndustryOption, string> = {
  Healthcare: "#0891B2",
  "Financial Services": "#019E7C",
  Technology: "#2563EB",
  Manufacturing: "#9333EA",
  Energy: "#CA8A04",
  Retail: "#EA580C",
  Government: "#475569",
  Education: "#D97706",
  Telecommunications: "#7C3AED",
  Transportation: "#0F766E",
  "Media & Entertainment": "#DB2777",
  "Real Estate": "#16A34A",
  Agriculture: "#65A30D",
  "Pharma & Biotech": "#BE185D",
  "Legal Services": "#4338CA",
  Hospitality: "#F59E0B",
  Nonprofit: "#8B5CF6",
  "Defense & Aerospace": "#B91C1C",
  Insurance: "#0EA5E9",
  "Professional Services": "#6D28D9",
};

/** Legend + dropdown: 20 industries + Other (unknown / unmatched) */
export const INDUSTRY_COLORS: Record<string, string> = {
  ...CANONICAL,
  Other: DEFAULT_HEX,
};

/** Legacy topic / model labels → canonical grid label (see backend `_INDUSTRY_NAME_ALIASES`) */
const INDUSTRY_NAME_ALIASES: Record<string, IndustryOption> = {
  "Finance & Banking": "Financial Services",
  "Government & Public Sector": "Government",
  "Retail & E-Commerce": "Retail",
  "Energy & Utilities": "Energy",
};

export function industryColor(name: string): string {
  const canonical = canonicalIndustryLabel(name);
  if (canonical) return CANONICAL[canonical];
  return INDUSTRY_COLORS[name] ?? DEFAULT_HEX;
}

/**
 * Map wizard / URL industry text to a canonical grid label (mirrors
 * `canonical_industry_label` in `backend/services/recommended_path_process_card_library.py`).
 */
export function canonicalIndustryLabel(name: string | null | undefined): IndustryOption | null {
  if (name == null) return null;
  const key = name.trim();
  if (!key || key === "Other") return null;
  if ((INDUSTRY_OPTIONS as readonly string[]).includes(key)) {
    return key as IndustryOption;
  }
  const alias = INDUSTRY_NAME_ALIASES[key];
  if (alias) return alias;
  const low = key.toLowerCase();
  for (const label of INDUSTRY_OPTIONS) {
    if (label.toLowerCase() === low) return label;
  }
  for (const [aliasKey, canonical] of Object.entries(INDUSTRY_NAME_ALIASES)) {
    if (aliasKey.toLowerCase() === low) return canonical;
  }
  return null;
}

/**
 * Short executive-tone descriptions used on the `/industries` feeder page.
 * One to two sentences each, vendor-neutral, calling out the dominant tech
 * tension a CEO/CIO/COO in that sector is most likely re-checking right now.
 */
export const INDUSTRY_DESCRIPTIONS: Record<IndustryOption, string> = {
  Healthcare:
    "HIPAA, ePHI security, AI-assisted clinical workflows, and the operational reality of running 24/7 critical-care systems on aging infrastructure.",
  "Financial Services":
    "Regulator-grade controls, fraud and AML automation, and the speed-versus-compliance tradeoff as AI moves into underwriting and customer-facing channels.",
  Technology:
    "Securing your own dogfood, governing internal AI adoption, and proving operational maturity to enterprise customers and auditors.",
  Manufacturing:
    "OT/IT convergence, ransomware exposure on the shop floor, and using AI for predictive maintenance and supply-chain visibility.",
  Energy:
    "Critical-infrastructure security (NERC/CIP), grid modernisation, and the operational risk of geographically distributed assets.",
  Retail:
    "PCI scope reduction, fraud at scale, and AI-driven personalisation that respects consumer-privacy laws.",
  Government:
    "FedRAMP, StateRAMP and CJIS compliance, legacy-system modernisation, and the procurement realities of public-sector IT.",
  Education:
    "FERPA, student-data privacy, classroom AI policy, and stretching constrained IT budgets across rapidly growing demand.",
  Telecommunications:
    "Network resilience, customer-data protection at scale, and the AI/automation play in NOC and customer-support operations.",
  Transportation:
    "Operational technology risk in fleets and depots, telematics-data governance, and AI-enabled routing and safety systems.",
  "Media & Entertainment":
    "Content-pipeline security, generative-AI rights management, and cost discipline on streaming infrastructure at scale.",
  "Real Estate":
    "Smart-building security, tenant-data privacy, and the operational tech stack across distributed property portfolios.",
  Agriculture:
    "AgTech IoT security, supply-chain traceability, and applying AI to yield, weather, and equipment-health data.",
  "Pharma & Biotech":
    "GxP compliance, IP protection across research and clinical pipelines, and the AI-in-discovery governance question regulators are starting to ask.",
  "Legal Services":
    "Privileged-data security, generative-AI risk in matter management, and the compliance posture clients are increasingly pricing into RFPs.",
  Hospitality:
    "PCI compliance, guest-data privacy, and using AI to operate leaner across distributed properties without losing service quality.",
  Nonprofit:
    "Donor-data security, mission-cost discipline, and squeezing real value out of AI without enterprise-scale budgets.",
  "Defense & Aerospace":
    "CMMC, ITAR, supply-chain provenance, and the operational security of long-lifecycle classified and dual-use systems.",
  Insurance:
    "Underwriting AI governance, claims-fraud automation, and the regulatory scrutiny that follows model-driven decisions.",
  "Professional Services":
    "Client-data security, AI productivity gains in delivery work, and demonstrating SOC 2 / ISO posture as a sales enabler.",
};

export function industryDescription(name: string): string {
  return (INDUSTRY_DESCRIPTIONS as Record<string, string>)[name] ?? "";
}

/**
 * One sentence per sector describing how the work concretely changes there —
 * the demonstration layer under the tension list above. Same voice as the
 * Managed Business Technology industry section: what dominates, and what we
 * actually do about it. Keep these operational and vendor-neutral.
 */
export const INDUSTRY_HOW_WE_FIT: Record<IndustryOption, string> = {
  Healthcare:
    "The work concentrates on where patient records travel between clinical, billing, and messaging systems — and on holding automation to a human review step before it touches either.",
  "Financial Services":
    "Permissions reviewed on a schedule, automation logged so a decision can be reconstructed later, and policy written to survive an examiner reading it.",
  Technology:
    "Access discipline across your own stack, evidence enterprise customers can audit, and internal AI use governed as deliberately as the product roadmap.",
  Manufacturing:
    "Segmenting production equipment from business systems, then moving its output into planning and reporting without opening a path back in.",
  Energy:
    "Segmentation and monitoring built for assets that sit far apart, and change control that respects systems which cannot simply be rebooted.",
  Retail:
    "Keeping card data out of scope by design, one technology standard across every store, and a single help desk instead of whatever each location assembled.",
  Government:
    "Working inside procurement cycles and public-sector frameworks, modernizing legacy systems in steps that keep services running through the transition.",
  Education:
    "Student-data boundaries enforced in the systems teachers actually use, and a written AI policy in place before classroom tools decide it for you.",
  Telecommunications:
    "Resilience engineering for customer-facing infrastructure, and automation in support operations with a clear escalation path to a human.",
  Transportation:
    "Telematics and depot systems feeding planning without exposing the fleet, and recovery plans built for operations that never fully stop.",
  "Media & Entertainment":
    "Locking down content pipelines and rights-sensitive assets while keeping the creative tools people rely on fast and available.",
  "Real Estate":
    "One technology standard across the portfolio: building systems segmented from tenant data, and vendor access scoped and logged.",
  Agriculture:
    "Field equipment and sensor data integrated into planning systems, with connectivity and recovery plans that assume remote sites.",
  "Pharma & Biotech":
    "Validated-system discipline: research and clinical data with clear provenance, access history, and change control a regulator can read.",
  "Legal Services":
    "Data boundaries drawn per client rather than per company, and explicit rules about which matter information may enter which tool.",
  Hospitality:
    "Standard, remotely supported technology across properties so a front desk never waits on a site visit, with card data kept out of scope.",
  Nonprofit:
    "Donor data protected to commercial standards on a nonprofit budget, and automation applied where it returns staff hours to the mission.",
  "Defense & Aerospace":
    "Enclave separation, supply-chain provenance, and evidence discipline mapped to CMMC — kept current rather than assembled before an audit.",
  Insurance:
    "Model-driven decisions logged and reviewable, carrier and agency systems integrated, and evidence ready when a regulator asks how a decision was made.",
  "Professional Services":
    "Client confidentiality enforced in the tools themselves, billable work protected from system interruptions, and a security posture you can show in an RFP.",
};
