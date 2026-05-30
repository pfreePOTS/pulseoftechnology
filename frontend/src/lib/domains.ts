/** Canonical fallback when /api/public/domains is unavailable. */
export const FALLBACK_DOMAINS = [
  {
    slug: "ai",
    label: "Artificial Intelligence",
    short_label: "AI",
    description: "Models, agents, LLM safety, ML platforms, and AI governance.",
    color: "#7C3AED",
    sort_order: 10,
    status: "core",
  },
  {
    slug: "security",
    label: "Cybersecurity",
    short_label: "Security",
    description: "Threats, IAM, zero trust, SOC, and cyber resilience.",
    color: "#D5171E",
    sort_order: 20,
    status: "core",
  },
  {
    slug: "cloud",
    label: "Cloud Platforms",
    short_label: "Cloud",
    description: "Public cloud, multi-cloud, FinOps, and cloud-native architecture.",
    color: "#38BDF8",
    sort_order: 30,
    status: "core",
  },
  {
    slug: "storage",
    label: "Enterprise Storage",
    short_label: "Storage",
    description: "NAS, SAN, object storage, backup/DR, and data lifecycle.",
    color: "#0D9488",
    sort_order: 40,
    status: "core",
  },
  {
    slug: "compliance",
    label: "Compliance & Governance",
    short_label: "Compliance",
    description: "GDPR, HIPAA, DORA, audit, third-party risk, and regulatory tech.",
    color: "#10B981",
    sort_order: 50,
    status: "core",
  },
  {
    slug: "infrastructure",
    label: "Infrastructure",
    short_label: "Infrastructure",
    description: "Networking, servers, OS, virtualization, and datacenter.",
    color: "#F59E0B",
    sort_order: 60,
    status: "core",
  },
] as const;

export type PublicDomain = {
  slug: string;
  label: string;
  short_label: string;
  description?: string | null;
  color: string;
  sort_order?: number;
  status?: string;
};

export type TopicDomainRef = {
  slug: string;
  label: string;
  short_label: string;
  color: string;
};

export type RadarTopicWithDomain = {
  domain: TopicDomainRef | string;
};

let cachedDomains: PublicDomain[] | null = null;

export function getCachedDomains(): PublicDomain[] {
  return cachedDomains ?? [...FALLBACK_DOMAINS];
}

export function setCachedDomains(domains: PublicDomain[]): void {
  cachedDomains = domains;
}

export function domainBadgeClass(shortLabel: string | null | undefined): string {
  const key = (shortLabel || "Other").trim();
  return DOMAIN_BADGE_CLASSES[key] ?? DOMAIN_BADGE_CLASSES.Other;
}

const DOMAIN_BADGE_CLASSES: Record<string, string> = {
  AI: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
  Security: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
  Cloud: "bg-sky-500/20 text-sky-400 ring-sky-500/30",
  Storage: "bg-teal-500/20 text-teal-400 ring-teal-500/30",
  Compliance: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
  Infrastructure: "bg-amber-500/20 text-amber-400 ring-amber-500/30",
  Other: "bg-slate-500/20 text-slate-400 ring-slate-500/30",
};

export function domainColor(domain: TopicDomainRef | string | null | undefined): string {
  if (!domain) return "#6B7280";
  if (typeof domain === "string") {
    const hit = getCachedDomains().find(
      (d) => d.slug === domain || d.short_label === domain,
    );
    return hit?.color ?? "#6B7280";
  }
  return domain.color || "#6B7280";
}

export function domainShortLabel(domain: TopicDomainRef | string | null | undefined): string {
  if (!domain) return "Other";
  if (typeof domain === "string") return domain;
  return domain.short_label || domain.slug;
}

export function domainSlug(domain: TopicDomainRef | string | null | undefined): string {
  if (!domain) return "other";
  if (typeof domain === "string") {
    const hit = getCachedDomains().find(
      (d) => d.slug === domain.toLowerCase() || d.short_label === domain,
    );
    return hit?.slug ?? domain.toLowerCase();
  }
  return domain.slug;
}

export const RADAR_DOMAIN_SLUGS = FALLBACK_DOMAINS.map((d) => d.slug);

export function normalizeRadarDomainSlug(value: string | null | undefined): string {
  const clean = (value || "").trim().toLowerCase();
  if (!clean) return "";
  const known = getCachedDomains().some((d) => d.slug === clean || d.short_label.toLowerCase() === clean);
  return known ? clean : "";
}

export function filterByRadarDomainSlug<T extends RadarTopicWithDomain>(
  items: T[],
  slug: string,
): T[] {
  const clean = normalizeRadarDomainSlug(slug);
  if (!clean) return items;
  return items.filter((item) => domainSlug(item.domain) === clean);
}
