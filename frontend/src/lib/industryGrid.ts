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
