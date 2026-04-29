/**
 * Split prose into sentences using common terminators (. ? !).
 * Best-effort only — abbreviations may occasionally split wrong.
 */
export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+/).map((p) => p.trim());
  return parts.filter(Boolean);
}

/** Keep at most `max` sentences; joins with a single space. */
export function truncateToMaxSentences(text: string, max: number): string {
  if (!text.trim() || max < 1) return text.trim();
  const s = splitSentences(text);
  if (s.length <= max) return s.join(" ");
  return s.slice(0, max).join(" ");
}

/** Radar / tooltip copy: 3–6 sentences — cap verbosity at 6. */
export const RADAR_RATIONALE_MAX_SENTENCES = 6;

export function clampRadarRationaleParagraph(text: string): string {
  return truncateToMaxSentences(text, RADAR_RATIONALE_MAX_SENTENCES);
}

/**
 * Reshape a prose rationale into a "lead + bullets" structure for the radar
 * detail panel — long paragraphs become a key takeaway followed by supporting
 * points so the panel scans quickly instead of forcing readers through a wall
 * of text.
 *
 * Behaviour by sentence count:
 *  - 0 sentences  → empty (caller should fall back to a paragraph)
 *  - 1–2 sentences → empty (lets the caller render the original paragraph;
 *                    bullets feel forced when there's only one supporting point)
 *  - 3+ sentences → first sentence as `lead`, remainder as `bullets`
 */
export function structureRationale(text: string): {
  lead: string;
  bullets: string[];
} {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return { lead: "", bullets: [] };
  return { lead: sentences[0], bullets: sentences.slice(1) };
}
