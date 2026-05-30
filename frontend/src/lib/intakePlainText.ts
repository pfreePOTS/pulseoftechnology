/**
 * Strip accidental markup from intake query fields (paste/CMS/HTML links).
 * Not a security sanitizer for trusted HTML — only removes angle-bracket tags
 * and a few entities so UI + API params show plain language.
 */
export function intakePlainText(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/<[^>]*>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}
