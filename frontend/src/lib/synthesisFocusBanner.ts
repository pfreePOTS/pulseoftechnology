/**
 * Horizontal band assets for intake “Focus” (URL `issue`), layered under the industry band
 * on “What we think” synthesis cards.
 *
 * Files: `public/images/synthesis-focus/{slug}.jpg` — aligns with `ExecutiveIntakeForm` ISSUES[].value,
 * plus lightweight substring hints for free-text “Other” answers (parity with `_domains_for_intake_issue`).
 */

export type SynthesisFocusBannerSlug =
  | "cybersecurity"
  | "ai"
  | "compliance"
  | "cloud"
  | "it-management"
  | "strategy"
  | "other";

const TO_SLUG: Record<string, SynthesisFocusBannerSlug> = {
  Cybersecurity: "cybersecurity",
  AI: "ai",
  Compliance: "compliance",
  Cloud: "cloud",
  "IT Management": "it-management",
  Strategy: "strategy",
  Other: "other",
};

/** Wizard enum → basename under `public/images/synthesis-focus/`. */
export function synthesisFocusBannerSlug(issueRaw: string): SynthesisFocusBannerSlug | null {
  const trimmed = issueRaw.trim();
  if (!trimmed) return null;
  const direct = TO_SLUG[trimmed];
  if (direct) return direct;

  const lo = trimmed.toLowerCase();
  /** Free-text cues when users skip preset buttons (`Other`). */
  if (/(cyber|threat|ransom|nist|zero[\s-]?trust|\bsoc\b|\bsiem\b)/.test(lo)) {
    return "cybersecurity";
  }
  if (
    /\bllm\b|\bgpt\b|genai|generative\s*ai|\bmachine\s*learning\b|^ai\b|^ai |\sai |\sai$|\bai agents?\b/i.test(trimmed)
  ) {
    return "ai";
  }
  if (/compliance|\b(sox|hipaa|cisa|privacy law|audit)\b|regulator/.test(lo)) return "compliance";
  if (/\b(aws|azure|gcp|saas|kubernetes|infra|cloud)\b/.test(lo)) return "cloud";
  if (/it\s*management|\bmsp\b|\bhelp\s*desk|\bservice\s*desk/.test(lo)) return "it-management";
  if (/\bleadership\b|\b(board|culture|cio|cto)\b|long[\s-]*term\s*strategy|technology\s*strategy/.test(lo)) {
    return "strategy";
  }
  if (/\bother\b|^misc|general/.test(lo)) return "other";
  return null;
}

export function synthesisFocusBannerSrc(issueRaw: string): string | null {
  const slug = synthesisFocusBannerSlug(issueRaw);
  if (!slug) return null;
  return `/images/synthesis-focus/${slug}.jpg`;
}
