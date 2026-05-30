import type { EngagementExamplePayload } from "@/lib/recommendedPathTypes";
import type { RecommendedCaseStudy } from "@/lib/recommendedPathCaseStudies";

/** Map API engagement vignettes onto the existing In Action card model. */
export function engagementExamplesToCaseStudies(
  rows: EngagementExamplePayload[] | undefined | null,
): RecommendedCaseStudy[] | null {
  if (!rows?.length) return null;
  const out: RecommendedCaseStudy[] = [];
  for (const row of rows) {
    const title = row.title?.trim();
    if (!title) continue;
    const id = row.id?.trim() || "ops-ai-sequencing";
    const who = row.who?.trim() ?? "";
    const provided = row.provided?.trim() ?? "";
    const approach = row.approach?.trim() || who || title;
    const solution = row.solution?.trim() || provided || title;
    const howWeHelped = row.how_we_helped?.trim() || provided || approach;
    out.push({
      id,
      title,
      who: who || undefined,
      provided: provided || undefined,
      approach,
      solution,
      howWeHelped,
    });
    if (out.length >= 3) break;
  }
  return out.length >= 3 ? out : null;
}
