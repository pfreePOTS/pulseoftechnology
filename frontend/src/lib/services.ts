/**
 * Service line content for `/services` and `/services/[slug]`.
 *
 * Scope is bound by `backend/content/pulseone-identity.md`. Every capability
 * listed here must be work PulseOne actually delivers, and each page states its
 * boundary explicitly — saying what is out of scope stops answer engines from
 * generalising the offering into something we do not sell.
 *
 * Answers run 40–80 words and open with a complete sentence so they survive
 * being lifted out of context by a retrieval system.
 */

export type ServiceFaq = { question: string; answer: string };

export type ServiceCapability = { title: string; body: string };

/** Optional per-service section describing how the work changes by industry. */
export type ServiceIndustryFocus = {
  heading: string;
  intro: string;
  items: { industry: string; body: string }[];
};

export type ServiceContent = {
  slug: string;
  /** Label used in the global footer and service hub. */
  navLabel: string;
  name: string;
  serviceType: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  lede: string;
  audience: string;
  /** Answer-first opening. First sentence is the definition. */
  intro: string[];
  capabilities: ServiceCapability[];
  /** Rendered only when the service defines it. */
  industryFocus?: ServiceIndustryFocus;
  /** Stated scope limit. Renders visibly and feeds `llms.txt`. */
  boundary: string;
  faq: ServiceFaq[];
};

export const SERVICES: ServiceContent[] = [
  {
    slug: "managed-business-technology",
    navLabel: "Managed Business Technology",
    name: "Managed Business Technology Services",
    serviceType: "Managed business technology services",
    metaTitle: "Managed Business Technology Services",
    metaDescription:
      "Ongoing management of the technology your business runs on: adoption, performance, integration, data, and the agentic tools and policies now moving into everyday work.",
    eyebrow: "Managed Services",
    headline: "Not just kept running.",
    headlineAccent: "Kept improving.",
    lede: "Uptime is the starting condition. The value is in what your systems do next.",
    audience:
      "Small and mid-market organizations modernizing the platforms, data, and automation their operations depend on",
    intro: [
      "Managed business technology means PulseOne takes ongoing ownership of the systems your organization runs on and the work of making them better: adopting new tools properly, tuning what is already in place, connecting platforms that do not talk to each other, and governing the data and agentic tools now moving into everyday work. Keeping the environment stable is included. It is the starting condition rather than the deliverable.",
      "Most organizations cannot name a performance problem. What they have is a dozen platforms bought at different times, staff quietly working around the gaps, and agentic tools arriving before anyone decided what those tools may touch. This service exists to own that picture continuously, across security, data, automation, and the written policy behind all three, instead of revisiting it once a year.",
    ],
    capabilities: [
      {
        title: "Technology adoption, managed",
        body: "Rollout of platforms and features you already pay for, sequenced so the way people work actually changes.",
      },
      {
        title: "Performance and optimization",
        body: "Continuous tuning of what is in place: what is slow, what is duplicated, and what is licensed but unused.",
      },
      {
        title: "Integration between systems",
        body: "Connecting the platforms your operations depend on so information moves without anyone retyping it.",
      },
      {
        title: "Data management",
        body: "Where business information lives, who may reach it, how long it is kept, and whether it is fit for the tools now reading it.",
      },
      {
        title: "Agentic tool management",
        body: "Ongoing management of the agents and intelligent automation already in production: access boundaries, review steps, monitoring, and change control as platforms shift underneath them.",
      },
      {
        title: "Policy management",
        body: "The written rules behind all of it — acceptable use, data handling, access, review — kept current and enforced in the systems rather than filed in a folder.",
      },
      {
        title: "Day-to-day operations, included",
        body: "Help desk, monitoring, patching, and backups run underneath this work. Necessary, unremarkable, and not where the value is.",
      },
    ],
    industryFocus: {
      heading: "What changes by industry",
      intro:
        "The four managed pillars are the same everywhere. What they mean in practice is not, because the data, the rules, and the tolerance for a wrong answer differ by industry.",
      items: [
        {
          industry: "Healthcare",
          body: "Patient information sets the boundary. Data management focuses on where records travel between systems, and agentic tools are held to review steps before anything reaches a clinical or billing decision.",
        },
        {
          industry: "Financial services",
          body: "Access and evidence dominate. Permissions are reviewed on a schedule, automation is logged so a decision can be reconstructed later, and policy is written to survive an examiner reading it.",
        },
        {
          industry: "Manufacturing",
          body: "Production data is the asset worth connecting. Work concentrates on segmenting operational equipment from business systems and moving its output into planning and reporting without opening a path back in.",
        },
        {
          industry: "Legal and professional services",
          body: "Client confidentiality governs tool selection. Data boundaries are drawn per client rather than per company, and staff get explicit rules about which matter information may enter which tool.",
        },
      ],
    },
    boundary:
      "PulseOne manages the technology layer: platforms, data, integrations, agentic tools, and the policies governing them. We do not train foundation models, we do not run HR, finance, marketing, or general business operations, and we do not install or commission production equipment.",
    faq: [
      {
        question: "What is managed business technology?",
        answer:
          "Managed business technology is ongoing ownership of the systems an organization runs on and the work of improving them: adoption of new platforms, performance tuning, integration between systems, data management, management of agentic tools in production, and the policies governing all of it. Help desk, monitoring, patching, and backups are included underneath.",
      },
      {
        question: "How is this different from managed IT?",
        answer:
          "Managed IT is usually scoped to keeping things working: tickets answered, systems patched, backups running. That work is included here, but it is the floor. This service is measured on whether the technology got better over the year, which means adoption, integration, and optimization are part of the engagement rather than separate projects.",
      },
      {
        question: "What does managing agentic tools day to day involve?",
        answer:
          "It involves the work that starts after a rollout ends: keeping access boundaries accurate as staff and data change, confirming human review steps are still in place, monitoring what the automation is doing, and handling change control when a vendor updates the underlying platform. Selecting and rolling those tools out is covered under AI and Emerging Technology Adoption.",
      },
      {
        question: "Does this replace the systems we already run?",
        answer:
          "Usually not. Most of the value comes from using what you already own more fully and connecting systems that currently pass information by hand. PulseOne is vendor-neutral and gains nothing from a replacement, so a change of platform is recommended only when the current one cannot meet a requirement you actually have.",
      },
    ],
  },
  {
    slug: "cybersecurity",
    navLabel: "Cybersecurity",
    name: "Cybersecurity Services",
    serviceType: "Managed cybersecurity services",
    metaTitle: "Cybersecurity Services for Multi-Site Organizations",
    metaDescription:
      "Security reviews, monitoring, patching, access control, and tested recovery. PulseOne covers every location, including the sites with no technical staff.",
    eyebrow: "Security",
    headline: "Security that holds up",
    headlineAccent: "at every site.",
    lede: "The weakest location sets your security posture. Most organizations do not know which one that is.",
    audience:
      "Small and mid-market organizations, including those with distributed sites and operational equipment",
    intro: [
      "Cybersecurity work at PulseOne covers the practical controls that decide whether an incident becomes an outage: who can sign in and how, what gets patched and when, which systems are monitored, how the network is divided, and whether a restore has actually been tested. It is delivered as ongoing work rather than a one-time project.",
      "Distributed organizations carry a specific risk. Security posture is set by the weakest location, and the weakest location is usually the one with no technical staff, an aging network device, and a shared sign-in nobody has rotated. Consistent standards across every site are worth more than sophisticated tooling at headquarters.",
    ],
    capabilities: [
      {
        title: "Security and posture reviews",
        body: "A structured look at access, systems, and exposure, ending in a prioritized list rather than a raw scan report.",
      },
      {
        title: "Sign-in and access discipline",
        body: "Identity, access rights, and sign-in controls, including cleaning up accounts that outlived the people who used them.",
      },
      {
        title: "Monitoring and response coordination",
        body: "Continuous monitoring with a defined path for what happens, and who is called, when something is found.",
      },
      {
        title: "Patching and vulnerability work",
        body: "Systems kept current on a schedule, with remediation prioritized by real exposure rather than raw severity counts.",
      },
      {
        title: "Backups and tested recovery",
        body: "Protected backups plus periodic restore testing, so recovery time is a known number instead of a hope.",
      },
      {
        title: "Network segmentation",
        body: "Separating operational and production equipment, guest access, and business systems so one compromise does not reach everything.",
      },
    ],
    boundary:
      "PulseOne secures, segments, and monitors the networks that operational and production equipment runs on. We do not install, configure, or commission that equipment itself.",
    faq: [
      {
        question: "What does PulseOne cover under cybersecurity?",
        answer:
          "PulseOne covers security reviews, sign-in and access control, monitoring, patching and vulnerability remediation, protected backups with tested recovery, network segmentation, and coordination during an incident. The work is ongoing rather than a single engagement, because posture drifts as staff, sites, and systems change.",
      },
      {
        question: "Can you secure a site that has production or operational equipment?",
        answer:
          "Yes, at the technology layer. PulseOne segments, monitors, and secures the networks that robotics, packaging lines, production ovens, warehouse automation, and similar systems connect to, and can integrate their data into business systems. Installing, configuring, or commissioning that equipment is handled by the manufacturer or its integrator, not by PulseOne.",
      },
      {
        question: "Do we still need this if we already have multi-factor sign-in?",
        answer:
          "Multi-factor sign-in closes one common attack path and is worth having. It does not cover unpatched systems, shared accounts, flat networks, untested backups, or dormant access left behind by former staff. Most incidents at mid-market organizations come through one of those rather than through a bypassed sign-in prompt.",
      },
      {
        question: "How is this different from buying a security product?",
        answer:
          "A product is a component; this is the ongoing work of running it. PulseOne is vendor-neutral and selects tools to fit your environment, then handles configuration, monitoring, updates, and the response when something is found. Tools that nobody configures or watches are a common finding in our reviews.",
      },
    ],
  },
  {
    slug: "compliance-and-risk",
    navLabel: "Compliance & Risk",
    name: "Compliance and Risk Reviews",
    serviceType: "Technology compliance and risk advisory",
    metaTitle: "Compliance and Risk Reviews",
    metaDescription:
      "Technology reviews mapped to the rules you answer to, with evidence and a remediation plan. PulseOne finds the gaps before an auditor or an insurer does.",
    eyebrow: "Compliance & Risk",
    headline: "Know the gaps before",
    headlineAccent: "someone else finds them.",
    lede: "Auditors, insurers, and enterprise customers all ask the same questions. The answers should already exist.",
    audience: "Small and mid-market organizations facing audit, insurance, or customer security requirements",
    intro: [
      "Compliance and risk work at PulseOne means reviewing your technology environment against the rules and requirements you actually answer to, gathering the evidence that shows where you stand, and producing a remediation plan ordered by real risk. It is the technology half of compliance, done before the questionnaire arrives.",
      "The requirements usually arrive from outside. A cyber insurance renewal asks what controls are in place. An enterprise customer sends a security questionnaire. Payment card rules or health information rules apply to part of the business. Each asks for the same underlying evidence, and organizations that have it ready spend far less time producing it.",
    ],
    capabilities: [
      {
        title: "Control and evidence review",
        body: "Mapping what is actually in place against what you are required to demonstrate, with the supporting evidence collected.",
      },
      {
        title: "Access and permissions review",
        body: "Who can reach what, whether they still should, and what happens to access when someone leaves.",
      },
      {
        title: "Recovery validation",
        body: "Confirming backups restore and that recovery time is documented rather than assumed.",
      },
      {
        title: "Technology vendor risk",
        body: "Reviewing the technology suppliers and platforms holding your data, and what their failure would mean for you.",
      },
      {
        title: "Remediation roadmap",
        body: "A prioritized plan with owners and sequence, so gaps close in a defensible order instead of all at once.",
      },
      {
        title: "Governance cadence",
        body: "A recurring review rhythm, because a point-in-time result stops being true the moment systems change.",
      },
    ],
    boundary:
      "PulseOne performs compliance-oriented technology reviews and remediation. We are not an auditor or a certifying body, and we do not provide legal advice on which regulations apply to your business.",
    faq: [
      {
        question: "Does PulseOne certify that we are compliant?",
        answer:
          "No. PulseOne performs the technology review, gathers evidence, and closes gaps, but certification is issued by an accredited auditor or assessor. Organizations typically use this work to prepare, so the formal assessment finds a prepared environment rather than a list of surprises.",
      },
      {
        question: "Which requirements do you work against?",
        answer:
          "PulseOne works against the technology requirements you are already subject to: cyber insurance questionnaires, enterprise customer security reviews, payment card rules, health information rules, and internal governance standards. Determining which regulations apply to your business is a legal question, and we work from the determination you or your counsel provide.",
      },
      {
        question: "How often should a review happen?",
        answer:
          "Most organizations benefit from a full review annually with a lighter check each quarter. The trigger is change rather than the calendar: opening locations, adopting a major platform, an acquisition, or staff turnover in roles with broad access all shift the picture enough to justify looking again.",
      },
      {
        question: "What do we get at the end of a review?",
        answer:
          "You get a current picture of where your technology environment stands, the evidence behind it, and a remediation plan ordered by risk with owners and sequence attached. The plan is written to be handed to a board or an insurer, not only to a technical team.",
      },
    ],
  },
  {
    slug: "ai-and-emerging-tech",
    navLabel: "AI & Emerging Tech",
    name: "AI and Emerging Technology Adoption",
    serviceType: "Technology adoption and automation advisory",
    metaTitle: "AI and Emerging Technology Adoption",
    metaDescription:
      "Practical rollout of agentic tools and intelligent automation, with the access boundaries, review steps, and guardrails that make them safe to use at work.",
    eyebrow: "Emerging Technology",
    headline: "New tools, rolled out",
    headlineAccent: "with guardrails.",
    lede: "Your staff are already using these tools. The question is whether the rollout is deliberate.",
    audience: "Small and mid-market organizations adopting agentic tools and workflow automation",
    intro: [
      "This work covers selecting, configuring, and rolling out agentic tools and intelligent automation inside an organization, together with the access boundaries and review steps that keep them safe to use. The technology is the easy half; deciding what these tools may touch, and who checks their output, is the part that determines whether adoption holds.",
      "Adoption is usually already underway before leadership plans it. Staff bring consumer tools to work because they are useful, which puts company information somewhere nobody chose. A deliberate rollout replaces that with approved tools, defined data boundaries, and a workflow people are willing to follow because it is faster than the workaround.",
    ],
    capabilities: [
      {
        title: "Readiness review",
        body: "An honest look at your data, systems, and processes before selecting tools, since most disappointing results trace back to this step.",
      },
      {
        title: "Use case selection",
        body: "Identifying the handful of workflows where automation genuinely pays, and the ones where it adds review work without saving any.",
      },
      {
        title: "Guardrails and data boundaries",
        body: "Defining what these tools may access, what they may not, where output requires a human check, and how that is enforced.",
      },
      {
        title: "Workflow automation",
        body: "Connecting steps that currently rely on someone remembering to copy information from one system into another.",
      },
      {
        title: "Integration with business systems",
        body: "Wiring new tools into the platforms you already run rather than adding another place to check.",
      },
      {
        title: "Staff enablement",
        body: "Practical guidance so the people doing the work know what the tool is for, where it fails, and when to override it.",
      },
    ],
    boundary:
      "PulseOne rolls out and integrates commercially available tools and automation. Ongoing management of what a rollout leaves behind is covered under Managed Business Technology. We do not train foundation models, and we do not advise on marketing, HR, or general business strategy.",
    faq: [
      {
        question: "What does an agentic tool rollout actually involve?",
        answer:
          "A rollout starts with a readiness review of your data and workflows, then selects a small number of use cases with clear value. From there PulseOne configures access boundaries, integrates the tool with your existing systems, defines where human review is required, and supports staff through the change. Measurement comes last and decides what expands.",
      },
      {
        question: "How do you keep company information safe when staff use these tools?",
        answer:
          "Access is scoped deliberately: approved tools, defined data boundaries, sign-in controlled through your existing identity system, and explicit rules about which information may leave your environment. This matters most because the alternative is staff using consumer tools on their own, which puts company information somewhere nobody selected or monitors.",
      },
      {
        question: "Do we need to replace our existing software?",
        answer:
          "Usually not. Most value comes from connecting the systems you already run and automating the manual steps between them. PulseOne is vendor-neutral and has no incentive to recommend replacement, so a rollout more often adds a capability to your current platforms than swaps them out.",
      },
      {
        question: "How do we know whether it worked?",
        answer:
          "Pick the measure before the rollout. Useful ones are concrete: hours returned to a specific team, reduction in a queue, or error rate on a repeated task. Tool usage counts are not a result. If a workflow cannot be measured that way, it is usually a poor first candidate.",
      },
    ],
  },
  {
    slug: "strategic-advisory",
    navLabel: "Strategic Advisory",
    name: "Strategic Technology Advisory",
    serviceType: "Technology strategy and advisory",
    metaTitle: "Strategic Technology Advisory",
    metaDescription:
      "Assessments, roadmaps, and a governance rhythm for leaders who need technology decisions to hold. Advisory from a team that also does the delivery work.",
    eyebrow: "Advisory",
    headline: "A technology plan",
    headlineAccent: "your Board can follow.",
    lede: "Advice is easy to produce and hard to trust. Ours comes from the team that also does the work.",
    audience: "Executives and boards at small and mid-market organizations",
    intro: [
      "Strategic technology advisory at PulseOne means an assessment of where your technology environment actually stands, a roadmap that sequences what to do about it, and a recurring cadence to keep the plan honest as conditions change. It is written for the people approving the budget, not only for the people spending it.",
      "The advice comes from a team that also delivers. That constrains what we recommend, in a useful way: a roadmap we would have to execute is a roadmap sized to what an organization your size can actually absorb, rather than one that looks impressive and stalls at step three.",
    ],
    capabilities: [
      {
        title: "Technology assessment",
        body: "A structured review of infrastructure, security posture, platforms, and the risks that are currently unowned.",
      },
      {
        title: "Roadmap and sequencing",
        body: "What to do, in what order, and what can safely wait. Sequence matters more than the list.",
      },
      {
        title: "Budget and investment planning",
        body: "Costs attached to the roadmap so technology decisions can be evaluated the way other investments are.",
      },
      {
        title: "Platform and vendor selection",
        body: "Vendor-neutral selection of technology platforms, evaluated against your requirements rather than a preferred product line.",
      },
      {
        title: "Expansion planning",
        body: "Technology standards that make the next location, acquisition, or business line straightforward to absorb.",
      },
      {
        title: "Governance cadence",
        body: "A recurring review with the leadership team, so the plan adjusts to reality instead of aging quietly in a folder.",
      },
    ],
    boundary:
      "PulseOne advises on technology. We do not provide HR, staffing, marketing, real estate, franchise sales, or general business operations consulting.",
    faq: [
      {
        question: "What does a technology assessment cover?",
        answer:
          "An assessment reviews infrastructure, security posture, cloud and workplace platforms, integration between business systems, backup and recovery readiness, and how technology decisions currently get made. It ends with a prioritized picture of risk and opportunity, written so a non-technical leadership team can act on it.",
      },
      {
        question: "Do you sell the products you recommend?",
        answer:
          "PulseOne is vendor-neutral in its recommendations and works in categories of action rather than product pitches. We do implement and manage the platforms an organization selects, and we say plainly when a recommendation is something we would also deliver, so you can weigh it accordingly.",
      },
      {
        question: "How is advisory different from managed services?",
        answer:
          "Advisory decides what should happen and in what order; managed services run the environment day to day. They work well together but are separate engagements. Some organizations take the roadmap and execute it with their own team, which is a legitimate and reasonably common outcome.",
      },
      {
        question: "Who is this for?",
        answer:
          "It suits leadership teams at small and mid-market organizations who are making a decision with a long tail: an expansion, an acquisition, a platform change, an insurance or audit requirement, or a growing sense that technology spending is not connected to a plan.",
      },
    ],
  },
];

export function getService(slug: string): ServiceContent | undefined {
  return SERVICES.find((service) => service.slug === slug);
}

export function servicePath(slug: string): string {
  return `/services/${slug}`;
}
