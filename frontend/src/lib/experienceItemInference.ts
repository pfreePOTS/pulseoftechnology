import { EXPERIENCE_ICON_KEYS, type ExperienceIconKey } from "@/lib/recommendedPathTypes";

const KEY_SET = new Set<string>(EXPERIENCE_ICON_KEYS);

const ALIASES: Record<string, ExperienceIconKey> = {
  managed: "managed_services",
  msp: "managed_services",
  outsourced: "managed_services",
  cloud: "cloud_data",
  data_platform: "cloud_data",
  ai: "ai_emerging",
  gen_ai: "ai_emerging",
  genai: "ai_emerging",
  ml: "ai_emerging",
  vendor: "procurement",
  vendor_selection: "procurement",
  rfp: "procurement",
  dr: "continuity",
  bcdr: "continuity",
};

export function normalizeExperienceApiIcon(raw: string | undefined): ExperienceIconKey | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (!key) return null;
  const via = ALIASES[key] ?? (KEY_SET.has(key) ? (key as ExperienceIconKey) : null);
  return via;
}

/** Keyword routing mirrors `backend/services/ai_service._infer_experience_icon_from_text` (keep in sync deliberately). */
export function inferExperienceIconFromCopy(title: string, description: string): ExperienceIconKey {
  const hay = `${title} ${description}`.toLowerCase();
  const rules: [ExperienceIconKey, string[]][] = [
    ["security", ["cyber", "security", "threat", "soc ", "ransomware", "zero trust", "incident response"]],
    ["ai_emerging", ["generative ai", "genai", "machine learning", "llm ", "prompt", "copilot"]],
    ["cloud_data", ["cloud ", "saas", "kubernetes", "data warehouse", "data platform"]],
    ["continuity", ["disaster", "recovery", "resilien", "backup", "business continuity"]],
    ["procurement", ["procurement", "rfp", "supplier ", "sourcing"]],
    ["governance", ["governance", "compliance", "audit", "board", "regulator", "policies", "policy ", "cadences"]],
    ["managed_services", ["managed service", "co-sour", "outsourc", "extension of yours"]],
    ["advisory", ["advisory", "advisor", "fractional", "quarterly", "deep-dive", "check-in"]],
    ["assessment", ["assessment", "maturity", "readiness", "baseline", "peer practice"]],
  ];
  for (const [key, needles] of rules) {
    if (needles.some((n) => hay.includes(n))) return key;
  }
  return "default";
}

export function resolveExperienceItemIcon(item: {
  title: string;
  description: string;
  icon?: string;
}): ExperienceIconKey {
  const normalized = normalizeExperienceApiIcon(item.icon);
  if (normalized != null && normalized !== "default") return normalized;
  return inferExperienceIconFromCopy(item.title, item.description);
}
