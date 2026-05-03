import { API_BASE } from "./api";
import type { RecommendedPathIntake, RecommendedPathPayload } from "./recommendedPathTypes";

/** Returns `null` on non-OK HTTP, JSON parse failure, or thrown fetch errors (network, aborted, etc.). */
async function fetchRecommendedPathPayload(url: string): Promise<RecommendedPathPayload | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as RecommendedPathPayload;
  } catch {
    return null;
  }
}

function buildRecommendedPathUrl(intake: RecommendedPathIntake, skipAi: boolean): string {
  const u = new URL(`${API_BASE}/api/recommended-path`);
  const keys = ["region", "industry", "role", "issue", "stage"] as const;
  for (const k of keys) {
    u.searchParams.set(k, (intake[k] ?? "").trim());
  }
  if (skipAi) u.searchParams.set("skip_ai", "true");
  return u.toString();
}

/**
 * Primary: AI-assisted `skip_ai=false`. On `null`, retries once with deterministic `skip_ai=true`—same payload shape,
 * typically after provider issues or HTTP failures. Caller sees `null` only if **both** requests fail or return unusable bodies.
 */
export async function fetchRecommendedPathProgressive(
  intake: RecommendedPathIntake,
): Promise<RecommendedPathPayload | null> {
  const primary = await fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, false));
  if (primary !== null) return primary;
  return fetchRecommendedPathPayload(buildRecommendedPathUrl(intake, true));
}
