/**
 * Multi-named intake role identifiers ("CEO / President / Owner") organize content
 * behind the scenes, but the slash combo reads oddly in page copy. Map them to a
 * natural collective phrase for display; single titles pass through unchanged.
 * Mirrors ROLE_DISPLAY_PHRASES in backend `ai_service.py`.
 */
export const ROLE_DISPLAY_PHRASES: Record<string, string> = {
  "CEO / President / Owner": "organizational leaders",
  "CIO / CTO": "technology leaders",
  "IT Manager / Director": "IT leaders",
  "Other / Not Sure": "leadership teams",
};

/** Customer-facing phrase for an intake role; the raw identifier stays in data/URLs. */
export function roleDisplayPhrase(roleLabel: string): string {
  const t = roleLabel.trim();
  return ROLE_DISPLAY_PHRASES[t] ?? t;
}

/**
 * Headline/helper copy often uses naive "{role}s" phrasing ("CFOs in …").
 * Role labels such as Operations already end in "s"; avoid "Operationss".
 * Mapped multi-named roles come back as their collective phrase, un-pluralized.
 */
export function roleLabelPluralHeadline(roleLabel: string): string {
  const t = roleLabel.trim();
  if (!t) return t;
  const mapped = ROLE_DISPLAY_PHRASES[t];
  if (mapped) return mapped;
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
  return "A practical read on where to focus next";
}
