import { APEX_BLOG_REDIRECTS } from "./apexBlogRedirects";

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function to(sources: string[], destination: string): LegacyRedirect[] {
  return sources.map((source) => ({ source, destination, permanent: true }));
}

/** WordPress paths on pulseone.com, including apex posts mapped in apexBlogRedirects. */
export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  ...to(
    [
      "/our-services",
      "/it-management",
      "/information-technology-management",
      "/it-project-and-program-management",
      "/it-procurement-asset-license-management",
      "/it-planning-design-and-implementation",
      "/it-monitor-alert-and-manage",
      "/end-user-it-help-desk",
      "/it-storage-and-backup-management",
      "/it-communication-management",
      "/communications",
      "/small-business-it-solutions",
      "/it-consulting-company",
      "/backup-recovery-services-db2",
      "/data-backup-and-recovery-solutions-db1",
      "/it-operations-outsourcing",
      "/remote-workforce-solutions",
      "/business-continuity-solutions",
      "/business-continuity",
      "/bc",
      "/ms",
      "/ro",
      "/services/managed-it-services",
    ],
    "/services/managed-business-technology",
  ),
  ...to(
    ["/cyber-security-services", "/it-security-and-compliance-services", "/email-protection-faq"],
    "/services/cybersecurity",
  ),
  ...to(["/cmmc-compliance-services"], "/services/compliance-and-risk"),
  ...to(["/ai-consulting_and_integration"], "/services/ai-and-emerging-tech"),
  ...to(["/free-business-assessment", "/itreview"], "/assessments"),
  ...to(["/contact-us", "/inquiry"], "/contact"),
  ...to(["/about-us", "/partners"], "/approach"),
  ...to(["/solutions"], "/services"),
  ...to(["/behavioral-health", "/bh"], "/industries"),
  ...to(
    [
      "/los-angeles-it-consulting",
      "/outsourced-it-support-in-los-angeles",
      "/it-helpdesk-and-managed-services-los-angeles",
      "/it-company-los-angeles",
      "/it-support-los-angeles",
      "/los-angeles-it-services-company",
    ],
    "/locations/los-angeles",
  ),
  ...to(
    ["/managed-it-services-in-ventura", "/it-management-in-central-coast"],
    "/locations/ventura",
  ),
  ...to(["/managed-it-services-in-new-jersey"], "/locations/new-jersey"),
  ...to(["/bozeman"], "/locations/bozeman"),
  ...to(["/philadelphia"], "/locations/philadelphia"),
  ...to(["/privacy-policy"], "/privacy"),
  ...to(["/blog"], "https://blog.pulseone.com"),
  ...APEX_BLOG_REDIRECTS,
  // Former marketplace landing PDF paths (PulseOne_XX_landing.pdf) → /service-offers/<title-slug>.pdf
  ...[
    ["01", "security-baseline-assessment-for-microsoft-365"],
    ["02", "secure-score-review-for-microsoft-365"],
    ["03", "identity-security-assessment-for-microsoft-entra-id"],
    ["04", "readiness-assessment-for-microsoft-defender-for-business"],
    ["05", "endpoint-management-assessment-for-microsoft-intune"],
    ["06", "business-premium-value-assessment-for-microsoft-365"],
    ["07", "copilot-readiness-assessment-for-microsoft-365"],
    ["08", "ai-readiness-security-and-governance-assessment-for-microsoft-365"],
    ["09", "license-utilization-review-for-microsoft-365"],
    ["10", "environment-optimization-review-for-microsoft-365"],
    ["11", "governance-assessment-for-microsoft-teams-and-sharepoint"],
    ["12", "adoption-and-usage-assessment-for-microsoft-365"],
    ["13", "data-protection-readiness-assessment-for-microsoft-365"],
    ["14", "information-protection-assessment-for-microsoft-purview"],
    ["15", "cost-and-resource-optimization-review-for-microsoft-azure"],
    ["16", "security-posture-assessment-for-microsoft-azure"],
    ["17", "quick-win-automation-assessment-for-microsoft-power-automate"],
    ["18", "email-security-assessment-for-microsoft-365"],
    ["19", "compliance-and-policy-readiness-assessment-for-microsoft-365"],
    ["20", "backup-and-recovery-readiness-assessment-for-microsoft-365"],
    ["21", "managed-administration-service-for-microsoft-365"],
    ["22", "vulnerability-management-assessment-for-microsoft-defender"],
    ["23", "app-protection-policy-assessment-for-microsoft-intune"],
  ].flatMap(([id, slug]) =>
    to([`/marketplace-offers/PulseOne_${id}_landing.pdf`], `/service-offers/${slug}.pdf`),
  ),
];
