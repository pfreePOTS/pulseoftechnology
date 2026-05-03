/**
 * Headline/helper copy often uses naive "{role}s" phrasing ("CFOs in …").
 * Role labels such as Operations already end in "s"; avoid "Operationss".
 */
export function roleLabelPluralHeadline(roleLabel: string): string {
  const t = roleLabel.trim();
  if (!t) return t;
  if (/s$/i.test(t)) return t;
  return `${t}s`;
}

/**
 * Mirrors backend `_sparse_fallback_headline` so the hero stays specific when
 * SSR fetch times out or the API is briefly unavailable (see `ssrPublicApi` deadline).
 */
export function fallbackHeadlineFromIntake(
  region: string,
  industry: string,
  role: string,
  issue: string,
  stage: string,
): string {
  const ind = industry.trim();
  const rl = role.trim();
  const iss = issue.trim();
  const reg = region.trim();
  const stg = stage.trim();
  if (ind && rl) {
    return `Technology priorities for ${roleLabelPluralHeadline(rl)} in ${ind}`;
  }
  if (ind) {
    return `Technology posture that fits ${ind} leadership teams today`;
  }
  if (rl) {
    return `Executive technology priorities most relevant for ${roleLabelPluralHeadline(rl)} now`;
  }
  if (iss) {
    return `Perspective on ${iss}`;
  }
  if (reg) {
    return `What technology signals matter for leaders in ${reg}`;
  }
  if (stg) {
    return "Aligning posture before the next tooling or programme milestone";
  }
  return "Technology clarity that serves your leadership cadence";
}
