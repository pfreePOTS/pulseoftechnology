/** Apex WordPress post URLs → HubSpot blog (or closest safe destination).
 * Generated from pulseone.com WP REST posts + blog.pulseone.com inventory.
 * Exact slug matches only, plus one verified title rename and partner pages.
 * Orphans without a HubSpot twin go to the blog index.
 */

type ApexRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function redirect(source: string, destination: string): ApexRedirect {
  return { source, destination, permanent: true };
}

/** Partner / vendor landing posts that never moved to HubSpot. */
const PARTNER_PAGES = [
  "/blue-pisces",
  "/britevault",
  "/c-healthcare-blocks",
  "/dell-computer",
  "/fortinet",
  "/heartland-payment-systems",
  "/microsoft",
  "/sonicwall",
  "/western-computer",
] as const;

/** WordPress posts with a matching HubSpot slug (or verified rename). */
const HUBSPOT_POSTS: ReadonlyArray<{ source: string; destination: string }> = [
  { source: "/4-key-criteria-for-assessing-your-devops-processes", destination: "https://blog.pulseone.com/4-key-criteria-for-assessing-your-devops-processes" },
  { source: "/5-essential-email-security-tips-employees-need-to-know", destination: "https://blog.pulseone.com/5-essential-email-security-tips-employees-need-to-know" },
  { source: "/7-best-practices-for-layered-cybersecurity", destination: "https://blog.pulseone.com/7-best-practices-for-layered-cybersecurity" },
  { source: "/data-backup-and-disaster-recovery", destination: "https://blog.pulseone.com/data-backup-and-disaster-recovery" },
  { source: "/deploy-secure-and-compliant-apps-in-the-cloud", destination: "https://blog.pulseone.com/deploy-secure-and-compliant-apps-in-the-cloud" },
  { source: "/does-your-antivirus-software-defend-your-business", destination: "https://blog.pulseone.com/does-your-antivirus-software-defend-your-business" },
  { source: "/downtime-tolerance-what-it-is-and-why-it-matters", destination: "https://blog.pulseone.com/downtime-tolerance-what-it-is-and-why-it-matters" },
  { source: "/endpoint-security-what-is-malware-and-how-to-stop-it", destination: "https://blog.pulseone.com/endpoint-security-what-is-malware-and-how-to-stop-it" },
  { source: "/extending-cyber-protection-beyond-your-network-boundaries", destination: "https://blog.pulseone.com/extending-cyber-protection-beyond-your-network-boundaries" },
  { source: "/firewalls-everything-you-need-to-know-about", destination: "https://blog.pulseone.com/firewalls-everything-you-need-to-know-about" },
  { source: "/giving-your-remote-users-an-in-office-experience-with-gpus", destination: "https://blog.pulseone.com/giving-your-remote-users-an-in-office-experience-with-gpus" },
  { source: "/going-virtual-simplifies-and-reduces-costs-of-firewall-protection", destination: "https://blog.pulseone.com/going-virtual-simplifies-and-reduces-costs-of-firewall-protection" },
  { source: "/how-to-host-business-oriented-conference-calls", destination: "https://blog.pulseone.com/how-to-host-business-oriented-conference-calls" },
  { source: "/how-to-keep-your-business-secure-from-cyber-threats", destination: "https://blog.pulseone.com/how-to-keep-your-business-secure-from-cyber-threats" },
  { source: "/learn-why-your-business-needs-security-audits", destination: "https://blog.pulseone.com/learn-why-your-business-needs-security-audits" },
  { source: "/leveraging-technology-to-boost-workflow-efficiencies", destination: "https://blog.pulseone.com/leveraging-technology-to-boost-workflow-efficiencies" },
  { source: "/multi-factor-authentication-understanding-the-future-of-secure-access", destination: "https://blog.pulseone.com/multi-factor-authentication-understanding-the-future-of-secure-access" },
  { source: "/office-365-multi-factor-authentication-protect-your-business", destination: "https://blog.pulseone.com/office-365-multi-factor-authentication-protect-your-business" },
  { source: "/online-presence-more-important-now-than-ever", destination: "https://blog.pulseone.com/online-presence-more-important-now-than-ever" },
  { source: "/pci-dss-compliance-its-all-about-earning-customer-trust", destination: "https://blog.pulseone.com/pci-dss-compliance-its-all-about-earning-customer-trust" },
  { source: "/rules-for-a-successful-it-partnership", destination: "https://blog.pulseone.com/rules-for-a-successful-it-partnership" },
  { source: "/small-businesses-a-common-target-for-cybercriminals", destination: "https://blog.pulseone.com/small-businesses-a-common-target-for-cybercriminals" },
  { source: "/tech-talk-best-practices-for-implementing-layered-cybersecurity", destination: "https://blog.pulseone.com/7-best-practices-for-layered-cybersecurity" },
  { source: "/tech-talk-with-avepoint", destination: "https://blog.pulseone.com/tech-talk-with-avepoint" },
  { source: "/tech-talk-with-inboundav", destination: "https://blog.pulseone.com/tech-talk-with-inboundav" },
  { source: "/tech-talk-with-knit-security", destination: "https://blog.pulseone.com/tech-talk-with-knit-security" },
  { source: "/tech-talk-with-msp360", destination: "https://blog.pulseone.com/tech-talk-with-msp360" },
  { source: "/tech-talk-with-qomplx", destination: "https://blog.pulseone.com/tech-talk-with-qomplx" },
  { source: "/tech-talk-with-sparxworks", destination: "https://blog.pulseone.com/tech-talk-with-sparxworks" },
  { source: "/the-dynamics-of-cyber-security", destination: "https://blog.pulseone.com/the-dynamics-of-cyber-security" },
  { source: "/the-pros-and-cons-of-office-365-versus-google-workspace", destination: "https://blog.pulseone.com/the-pros-and-cons-of-office-365-versus-google-workspace" },
  { source: "/top-5-causes-and-preventions-of-data-breaches", destination: "https://blog.pulseone.com/top-5-causes-and-preventions-of-data-breaches" },
  { source: "/unique-tool-for-remote-teams-to-be-more-effective", destination: "https://blog.pulseone.com/unique-tool-for-remote-teams-to-be-more-effective" },
  { source: "/vpn-best-practices-for-managing-remote-access", destination: "https://blog.pulseone.com/vpn-best-practices-for-managing-remote-access" },
  { source: "/what-are-managed-service-providers-and-why-are-they-important-to-your-business", destination: "https://blog.pulseone.com/what-are-managed-service-providers-and-why-are-they-important-to-your-business" },
  { source: "/what-is-office-365-monitoring-and-why-you-need-it", destination: "https://blog.pulseone.com/what-is-office-365-monitoring-and-why-you-need-it" },
  { source: "/what-is-the-cyber-kill-chain", destination: "https://blog.pulseone.com/what-is-the-cyber-kill-chain" },
  { source: "/what-is-voip-and-five-reasons-why-your-company-needs-voip", destination: "https://blog.pulseone.com/what-is-voip-and-five-reasons-why-your-company-needs-voip" },
  { source: "/what-to-consider-when-thinking-about-your-office-365-migration", destination: "https://blog.pulseone.com/what-to-consider-when-thinking-about-your-office-365-migration" },
  { source: "/what-to-know-when-partnering-with-aws-or-azure", destination: "https://blog.pulseone.com/what-to-know-when-partnering-with-aws-or-azure" },
  { source: "/when-and-why-business-owners-should-hire-an-it-consultant", destination: "https://blog.pulseone.com/when-and-why-business-owners-should-hire-an-it-consultant" },
  { source: "/why-you-should-have-your-it-company-manage-your-website", destination: "https://blog.pulseone.com/why-you-should-have-your-it-company-manage-your-website" },
];

/** Published WP posts with no HubSpot twin. Preserve equity on the blog host. */
const ORPHAN_POSTS = [
  "/constant-forward-pressure",
  "/crapi-organizational-development-maybe-you-should-try-this",
  "/how-do-we-return-to-work-better-positioned-for-the-next-disaster",
  "/how-organizations-can-defend-against-advanced-persistent-threats",
  "/how-to-use-drip-marketing-to-drive-sales",
  "/it-consultant-101",
  "/moving-it-to-the-cloud-britevault-vs-aws-and-azure",
  "/product-thinking-vs-project-thinking",
  "/pulseone-insider-briefing",
  "/security-101-knowing-when-youve-been-hacked",
  "/tech-talk-seedpod",
  "/tech-talk-with-blue-pisces",
  "/tech-talk-with-britevault",
  "/tech-talk-with-concentrus",
  "/tech-talk-with-do-be-associates",
  "/tech-talk-with-guardsight",
  "/tech-talk-with-healthcare-blocks",
  "/tech-talk-with-heartland-payment-systems",
  "/tech-talk-with-heartland-payment-systems-part-2",
  "/tech-talk-with-it-glue",
  "/tech-talk-with-krost",
  "/tech-talk-with-remotelyme",
  "/tech-talk-with-smartpatch",
  "/tech-talk-with-sonicwall",
  "/tech-talk-with-sonicwall-episode-2",
  "/tech-talk-with-trade-rocket",
  "/what-is-a-structured-sales-process",
  "/what-is-a-vlan-and-why-is-it-important-to-you",
] as const;

const BLOG_HOME = "https://blog.pulseone.com";
const APPROACH = "/approach";

export const APEX_BLOG_REDIRECTS: readonly ApexRedirect[] = [
  ...HUBSPOT_POSTS.map((row) => redirect(row.source, row.destination)),
  ...PARTNER_PAGES.map((source) => redirect(source, APPROACH)),
  ...ORPHAN_POSTS.map((source) => redirect(source, BLOG_HOME)),
];

/** Every apex post path this module covers (for coverage tests). */
export const APEX_BLOG_SOURCES: readonly string[] = APEX_BLOG_REDIRECTS.map((r) => r.source);
