/**
 * Recommended-path hero uses a thematic background (industry / AI emphasis) plus
 * the same reddish-tint overlays as radar/home — see `recommended-path/page.tsx`.
 */

export type RecommendedHeroImage = {
  /** Public URL under `/public` */
  src: string;
  /** Passed to `<Image />` layout */
  objectPosition: string;
};

function mentionsAi(stage: string, issue: string): boolean {
  const s = `${issue} ${stage}`.toLowerCase();
  return (
    /\b(ai|ml|gpt|llm|genai)\b/i.test(s) ||
    /\b(ai agents?|agents?)\b/i.test(s) ||
    /\bcopilot\b/i.test(s) ||
    s.includes("machine learning") ||
    s.includes("generative") ||
    (s.includes("planning") && s.includes("ai"))
  );
}

/**
 * Prefer AI-focused art when intake mentions AI tooling; otherwise map canonical
 * industry phrases to bundled hero art. Fallback keeps the PulseOne corridor
 * treatment used elsewhere on marketing pages.
 */
export function resolveRecommendedPathHeroBackground(
  industry: string,
  issue: string,
  stage: string,
): RecommendedHeroImage {
  const ind = industry.trim().toLowerCase();

  /* Prefer a sector visual when canonical industry is unmistakable … */
  if (ind.includes("transport")) {
    return { src: "/recommended-path/hero-recommended-transport.png", objectPosition: "center 38%" };
  }

  if (mentionsAi(stage, issue)) {
    return { src: "/recommended-path/hero-recommended-ai.png", objectPosition: "center 42%" };
  }

  const techIndustry =
    ind.includes("technology") ||
    ind.includes("telecommunication") ||
    ind.includes("software") ||
    ind.includes("media") ||
    ind.includes("internet");
  const techIssue = /\b(ai|software|saas|platform|digital|analytics|machine learning)\b/i.test(
    `${issue} ${stage}`,
  );
  if (techIndustry || techIssue) {
    return { src: "/recommended-path/hero-recommended-ai.png", objectPosition: "center 40%" };
  }

  /* Broad professional sectors — subtle glass / executive ambience */
  const enterprise =
    ind.includes("health") ||
    ind.includes("financial") ||
    ind.includes("insurance") ||
    ind.includes("legal") ||
    ind.includes("government") ||
    ind.includes("retail") ||
    ind.includes("manufacturing") ||
    ind.includes("energy") ||
    ind.includes("defense") ||
    ind.includes("aerospace") ||
    ind.includes("education") ||
    ind.includes("hospitality") ||
    ind.includes("nonprofit") ||
    ind.includes("agricultur") ||
    ind.includes("pharma") ||
    ind.includes("biotech") ||
    ind.includes("real estate") ||
    ind.includes("professional") ||
    ind.includes("entertain");

  if (enterprise) {
    return { src: "/recommended-path/hero-recommended-enterprise.png", objectPosition: "center 35%" };
  }

  /* Shared Pulse marketing asset — always on-disk in production Compose images */
  return { src: "/FrontPage_SecurityImage.png", objectPosition: "center 30%" };
}
