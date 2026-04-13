/**
 * Pure UTC date label for article teasers — same output in Node SSR and the browser
 * (avoids Intl/locale/timezone hydration mismatches).
 */
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatStoryDateUtc(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const y = d.getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  if (y !== thisYear) {
    return `${month} ${day}, ${y}`;
  }
  return `${month} ${day}`;
}
