export const RADAR_DOMAINS = ["AI", "Security", "Cloud", "Finance", "Leadership", "Other"] as const;

export function normalizeRadarDomain(value: string | null | undefined): string {
  const clean = (value || "").trim();
  return RADAR_DOMAINS.includes(clean as (typeof RADAR_DOMAINS)[number]) ? clean : "";
}

export function filterByRadarDomain<T extends { domain: string }>(items: T[], domain: string): T[] {
  const clean = normalizeRadarDomain(domain);
  return clean ? items.filter((item) => item.domain === clean) : items;
}
