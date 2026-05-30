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

/** Legacy topic / model labels → same hex as canonical grid (see backend `_INDUSTRY_NAME_ALIASES`) */
const LEGACY_ALIASES: Record<string, string> = {
  "Finance & Banking": CANONICAL["Financial Services"],
  "Government & Public Sector": CANONICAL["Government"],
  "Retail & E-Commerce": CANONICAL["Retail"],
  "Energy & Utilities": CANONICAL["Energy"],
};

export function industryColor(name: string): string {
  return LEGACY_ALIASES[name] ?? INDUSTRY_COLORS[name] ?? DEFAULT_HEX;
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
  const alias = LEGACY_ALIASES[key];
  if (alias) return alias;
  const low = key.toLowerCase();
  for (const label of INDUSTRY_OPTIONS) {
    if (label.toLowerCase() === low) return label;
  }
  for (const [aliasKey, canonical] of Object.entries(LEGACY_ALIASES)) {
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
