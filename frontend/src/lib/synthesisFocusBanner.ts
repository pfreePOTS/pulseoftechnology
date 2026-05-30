import { synthesisBannerVariantV } from "@/lib/synthesisBannerVariants";

/**
 * Horizontal band assets for intake “Focus” (URL `issue`), layered under the industry band
 * on “What we think” synthesis cards.
 *
 * Files: ``public/images/synthesis-focus/{slug}-v{1…N}.jpg`` — aligns with ISSUES[].value + title hints.
 * **Asset spec:** **1600×1000** (8:5) JPEG — see `frontend/scripts/README_SYNTHESIS_BANNERS.md`.
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
  if (
    /\bmicrosoft\b|\blicense\b|\bm365\b|\boffice\s*365\b|\bo365\b|\bentra\b/i.test(trimmed)
  )
    return "it-management";
  if (/\bleadership\b|\b(board|culture|cio|cto)\b|long[\s-]*term\s*strategy|technology\s*strategy/.test(lo)) {
    return "strategy";
  }
  if (/\bother\b|^misc|general/.test(lo)) return "other";
  return null;
}

export function synthesisFocusBannerSrc(issueRaw: string, cardIndex = 0): string | null {
  const slug = synthesisFocusBannerSlug(issueRaw);
  if (!slug) return null;
  return synthesisFocusBannerSrcFromSlug(slug, cardIndex);
}

export function synthesisFocusBannerSrcFromSlug(slug: SynthesisFocusBannerSlug, cardIndex = 0): string {
  const v = synthesisBannerVariantV(cardIndex, slug, "focus");
  return `/images/synthesis-focus/${slug}-v${v}.jpg`;
}

/**
 * Map a synthesis card headline to a topic band image (same assets as intake “Focus”).
 * Order matters — e.g. “readiness & risk” should prefer security over generic “AI”.
 */
export function synthesisTopicSlugFromCardTitle(title: string): SynthesisFocusBannerSlug | null {
  const t = title.trim();
  if (!t) return null;
  const lo = t.toLowerCase();

  if (/^(understand|recommend|implement|manage)$/.test(lo)) {
    const map: Record<string, SynthesisFocusBannerSlug> = {
      understand: "strategy",
      recommend: "strategy",
      implement: "cloud",
      manage: "it-management",
    };
    return map[lo] ?? null;
  }

  if (
    /\bgovernance\b|oversight|ethics|board|monitoring|drift|bias|\bhipaa\b|regulator|audit\b|compliance/.test(lo)
  ) {
    return "compliance";
  }
  if (/roadmap|phased|adoption|rollout|\bplan\b|priorit/.test(lo)) {
    return "strategy";
  }
  if (/readiness|\brisk\b|threat|security|ransom|zero[\s-]?trust|nist/.test(lo)) {
    return "cybersecurity";
  }
  if (/\bai\b|generative|llm|machine\s+learning|genai|\bgpt\b/.test(lo)) {
    return "ai";
  }
  if (/cloud|kubernetes|\bsaas\b|aws|azure|\bgcp\b|infra/.test(lo)) {
    return "cloud";
  }
  if (/it\s*management|\bmsp\b|service\s*desk|help\s*desk/.test(lo)) {
    return "it-management";
  }
  return null;
}

const TOPIC_SLUG_POOL: SynthesisFocusBannerSlug[] = [
  "cybersecurity",
  "ai",
  "strategy",
  "compliance",
  "cloud",
  "it-management",
  "other",
];

/** One distinct topic visual per card; prefers title / intake issue, then rotates through the pool. */
export function distinctTopicSlugsForCards(cardTitles: string[], issueRaw: string): SynthesisFocusBannerSlug[] {
  const issueSlug = synthesisFocusBannerSlug(issueRaw);
  const used = new Set<SynthesisFocusBannerSlug>();

  return cardTitles.map((title, i) => {
    const slug = synthesisTopicSlugFromCardTitle(title) ?? issueSlug ?? TOPIC_SLUG_POOL[i % TOPIC_SLUG_POOL.length]!;

    if (!used.has(slug)) {
      used.add(slug);
      return slug;
    }

    for (const candidate of TOPIC_SLUG_POOL) {
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }

    used.add(slug);
    return slug;
  });
}
