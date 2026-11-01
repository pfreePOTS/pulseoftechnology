export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function to(sources: string[], destination: string): LegacyRedirect[] {
  return sources.map((source) => ({ source, destination, permanent: true }));
}

/** WordPress paths on pulseone.com. Apex blog posts are intentionally absent. */
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
];
