export const PRIVACY_PATH = "/privacy";

export const PRIVACY_INTRO =
  "PulseOne values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect personal information in connection with the PulseOne website and user accounts.";

export type PrivacySection = {
  heading: string;
  paragraphs: string[];
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    heading: "Information We Collect",
    paragraphs: [
      "We collect limited personal information necessary to operate the Website and manage user accounts.",
      "Information you provide: name, email address, account login credentials (stored in encrypted or hashed form), and communications submitted through contact or support forms.",
      "Information collected automatically: IP address, browser type and version, device and operating system information, log and usage data (pages visited, timestamps), and cookies and similar tracking technologies.",
    ],
  },
  {
    heading: "How We Use Information",
    paragraphs: [
      "We use the information described above to create and manage user accounts, authenticate users and provide secure access to assessments, operate and improve the website, respond to inquiries, monitor usage and security, and comply with legal obligations.",
    ],
  },
  {
    heading: "Cookies and Tracking Technologies",
    paragraphs: [
      "We use cookies and similar technologies to enable core website functionality, maintain login sessions, improve performance and security, and understand usage patterns through analytics. You can control cookies through your browser settings. Disabling cookies may affect website functionality.",
    ],
  },
  {
    heading: "Sharing of Information",
    paragraphs: [
      "We may share personal information with service providers that host or support the website, vendors providing analytics, security, or technical services, and legal or regulatory authorities if required by law or to protect our rights. PulseOne does not sell personal information.",
    ],
  },
  {
    heading: "Data Retention",
    paragraphs: [
      "We retain personal information for as long as necessary to maintain your account, provide website functionality, and comply with legal, regulatory, or contractual obligations. Information may be deleted or anonymized upon account closure, subject to applicable laws.",
    ],
  },
  {
    heading: "Data Security",
    paragraphs: [
      "We implement reasonable administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, disclosure, alteration, or destruction.",
    ],
  },
  {
    heading: "Your Rights and Choices",
    paragraphs: [
      "Depending on your location, you may have the right to access or update your account information, request deletion of your account, and opt out of certain communications.",
    ],
  },
  {
    heading: "California Residents",
    paragraphs: [
      "If you are a California resident, you may have rights under the California Consumer Privacy Act (CCPA/CPRA), including the right to know what personal information we collect, request deletion of personal information, and not be discriminated against for exercising your rights.",
    ],
  },
  {
    heading: "Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of the PulseOne website after changes become effective constitutes acceptance of the revised policy.",
    ],
  },
  {
    heading: "Contact Us",
    paragraphs: [
      "If you have questions or concerns about this Privacy Policy or our data practices, contact PulseOne at support@pulseone.com.",
    ],
  },
];
