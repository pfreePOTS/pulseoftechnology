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

/**
 * Optional ordered recommendation for how an organization should start.
 * Rendered as numbered steps; order is the advice, so it matters.
 */
export type ServicePathForward = {
  heading: string;
  intro: string;
  steps: { title: string; body: string }[];
  /** Closing line under the steps, e.g. tying them back to services. */
  outro?: string;
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
  /** Rendered only when the service defines it. */
  pathForward?: ServicePathForward;
  /** Stated scope limit. Renders visibly and feeds `llms.txt`. */
  boundary: string;
  /** Sidebar heading above `boundary`. Defaults to "Where this stops". */
  boundaryHeading?: string;
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
      "Managed business technology means PulseOne takes ongoing ownership of the systems your organization runs on and the work of making them better: adopting new tools properly, tuning what's already in place, connecting platforms that don't talk to each other, and governing the data and AI tools now moving into everyday work. Keeping everything stable is included. We just don't consider it the whole job.",
      "Few organizations can point to one big performance problem. What they have is a dozen platforms bought at different times, staff working around the gaps, and AI tools showing up before anyone decided what they're allowed to touch. Somebody has to own that whole picture, all year. That's what this service is for.",
      "Security, data, policy, and automation aren't side issues to AI adoption. They're the foundation it stands on, and they decide whether it pays off or slowly falls apart. Managing that foundation is the core of this service.",
    ],
    capabilities: [
      {
        title: "Technology adoption, managed",
        body: "Rollout of platforms and features you already pay for, in an order that changes how people actually work.",
      },
      {
        title: "Performance and optimization",
        body: "Ongoing tuning of what you have: what's slow, what's duplicated, and what you're paying for but not using.",
      },
      {
        title: "Integration between systems",
        body: "Connecting the platforms your operations depend on so information moves without anyone retyping it.",
      },
      {
        title: "Security management",
        body: "Sign-ins, access rights, configuration, and exposure across everything above, handled as part of the regular work instead of a once-a-year audit.",
      },
      {
        title: "Data management",
        body: "Where business information lives, who may reach it, how long it is kept, and whether it is fit for the tools now reading it.",
      },
      {
        title: "Backup and data recovery",
        body: "Protected backups, with restores we test. If you ask how long recovery takes, you should get a number, not a guess.",
      },
      {
        title: "Agentic tool management",
        body: "Ongoing management of the agents and intelligent automation already in production: access boundaries, review steps, monitoring, and change control as platforms shift underneath them.",
      },
      {
        title: "Policy management",
        body: "The written rules behind all of it: acceptable use, data handling, access, review. We keep them current and wired into the systems, not filed away in a folder.",
      },
      {
        title: "Day-to-day operations, included",
        body: "Help desk, monitoring, and patching still run underneath all of this. They matter, they're covered, and they're not the interesting part.",
      },
    ],
    industryFocus: {
      heading: "What changes by industry",
      intro:
        "The capabilities are the same everywhere, but what they mean in practice depends on the data you hold, the rules you answer to, and what a wrong answer costs in your industry.",
      items: [
        {
          industry: "Healthcare",
          body: "Patient information sets the boundary. Data management focuses on where records travel between systems, and AI tools get a human review step before anything touches a clinical or billing decision.",
        },
        {
          industry: "Financial services",
          body: "It comes down to access and evidence: permissions reviewed on a schedule, automation logged well enough to reconstruct a decision later, and policies written with an examiner in mind.",
        },
        {
          industry: "Manufacturing",
          body: "The production floor is the asset. Most of the work is separating operational equipment from business systems, then getting its data into planning and reporting without opening a path back in.",
        },
        {
          industry: "Legal and professional services",
          body: "Client confidentiality drives everything. Data boundaries get drawn per client, not per company, and staff get clear rules about which matter information can go into which tool.",
        },
      ],
    },
    boundaryHeading: "How we work with you",
    boundary:
      "You know your company, your customers, and how the work really gets done. We bring industry knowledge, business process understanding, and technology expertise, and we manage the platforms, data, integrations, AI tools, and policies your business depends on. The goal is improvement that builds year over year instead of starting over every January.",
    faq: [
      {
        question: "What is managed business technology?",
        answer:
          "Managed business technology is ongoing ownership of the systems an organization runs on and the work of improving them: adoption of new platforms, performance tuning, integration between systems, data management, management of agentic tools in production, and the policies governing all of it. Help desk, monitoring, patching, and backups are included underneath.",
      },
      {
        question: "How is this different from managed IT?",
        answer:
          "Managed IT is usually scoped to keeping things working: tickets answered, systems patched, backups running. That work is included here, but it's just the baseline. We measure this service on whether your technology got better over the year, so adoption, integration, and optimization are part of the engagement, not separate projects you have to buy.",
      },
      {
        question: "What does managing agentic tools day to day involve?",
        answer:
          "It involves the work that starts after a rollout ends: keeping access boundaries accurate as staff and data change, confirming human review steps are still in place, monitoring what the automation is doing, and handling change control when a vendor updates the underlying platform. Selecting and rolling those tools out is covered under AI and Emerging Technology Adoption.",
      },
      {
        question: "Does this replace the systems we already run?",
        answer:
          "Usually not. Most of the value comes from using what you already own more fully and connecting systems that currently pass information by hand. PulseOne is vendor-neutral and gains nothing from a replacement, so we only recommend a platform change when the current one can't do something you need it to do.",
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
      "Cybersecurity work at PulseOne covers the practical controls that decide whether an incident becomes an outage: who can sign in and how, what gets patched and when, which systems are monitored, how the network is divided, and whether a restore has ever been tested. It's ongoing work, not a one-time project.",
      "Organizations with multiple sites carry a particular risk: your security is only as good as your weakest location, and that's usually the one with no technical staff, an aging network device, and a shared password nobody has changed. Consistent standards at every site do more good than sophisticated tooling at headquarters.",
    ],
    capabilities: [
      {
        title: "Security and posture reviews",
        body: "A structured look at access, systems, and exposure that ends in a prioritized list, not a two-hundred-page scan report.",
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
        body: "Systems kept current on a schedule, with fixes prioritized by real exposure, not by whatever a scanner scored highest.",
      },
      {
        title: "Backups and tested recovery",
        body: "Protected backups plus periodic restore testing, so we know recovery works before anyone needs it to.",
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
          "PulseOne covers security reviews, sign-in and access control, monitoring, patching and vulnerability remediation, protected backups with tested recovery, network segmentation, and coordination during an incident. The work is ongoing because environments drift: staff change, sites open, systems get replaced.",
      },
      {
        question: "Can you secure a site that has production or operational equipment?",
        answer:
          "Yes, at the technology layer. PulseOne segments, monitors, and secures the networks that robotics, packaging lines, production ovens, warehouse automation, and similar systems connect to, and can integrate their data into business systems. Installing, configuring, or commissioning that equipment is handled by the manufacturer or its integrator, not by PulseOne.",
      },
      {
        question: "Do we still need this if we already have multi-factor sign-in?",
        answer:
          "Multi-factor sign-in closes one common attack path and is worth having. It doesn't cover unpatched systems, shared accounts, flat networks, untested backups, or dormant access left behind by former staff. Most of the incidents we see at mid-market organizations start in one of those places.",
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
      "Compliance and risk work at PulseOne means reviewing your technology environment against the rules and requirements you answer to, gathering the evidence that shows where you stand, and producing a remediation plan ordered by real risk. It's the technology half of compliance, done before the questionnaire arrives.",
      "The requirements usually arrive from outside. A cyber insurance renewal asks what controls are in place. An enterprise customer sends a security questionnaire. Payment card rules or health information rules apply to part of the business. Each asks for the same underlying evidence, and organizations that have it ready spend far less time producing it.",
    ],
    capabilities: [
      {
        title: "Control and evidence review",
        body: "Mapping what's in place against what you have to demonstrate, and collecting the supporting evidence as we go.",
      },
      {
        title: "Access and permissions review",
        body: "Who can reach what, whether they still should, and what happens to access when someone leaves.",
      },
      {
        title: "Recovery validation",
        body: "Confirming your backups restore, and documenting real recovery times rather than assuming them.",
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
          "No. PulseOne performs the technology review, gathers evidence, and closes gaps, but certification is issued by an accredited auditor or assessor. Organizations typically use this work to prepare, so the formal assessment finds a ready environment instead of a list of surprises.",
      },
      {
        question: "Which requirements do you work against?",
        answer:
          "PulseOne works against the technology requirements you are already subject to: cyber insurance questionnaires, enterprise customer security reviews, payment card rules, health information rules, and internal governance standards. Determining which regulations apply to your business is a legal question, and we work from the determination you or your counsel provide.",
      },
      {
        question: "How often should a review happen?",
        answer:
          "Most organizations do well with a full review annually and a lighter check each quarter. The real trigger is change, not the calendar: opening locations, adopting a major platform, an acquisition, or turnover in roles with broad access all shift the picture enough to justify looking again.",
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
    lede: "Your staff are already using these tools. The question is whether anyone is steering.",
    audience: "Small and mid-market organizations adopting agentic tools and workflow automation",
    intro: [
      "This work covers selecting, configuring, and rolling out agentic tools and intelligent automation inside an organization, together with the access boundaries and review steps that keep them safe to use. The technology is the easy half. The hard part is deciding what these tools can touch and who checks their output, because that's what decides whether adoption sticks.",
      "Adoption is usually already underway before leadership plans it. Staff bring consumer tools to work because they're useful, which puts company information somewhere nobody chose. A planned rollout replaces that with approved tools, clear data boundaries, and a workflow people follow because it's faster than the workaround.",
      "Agents are the visible part of this shift, but they aren't the foundation. Whether adoption holds depends on what's underneath: security, data quality, integration, and the policies that govern all three. That's why the path forward starts with policy and an audit, not a purchase.",
    ],
    capabilities: [
      {
        title: "Readiness review",
        body: "A frank look at your data, systems, and processes before any tool gets picked. Most disappointing AI results trace back to skipping this step.",
      },
      {
        title: "Use case selection",
        body: "Finding the handful of workflows where automation pays for itself, and flagging the ones where it just adds review work.",
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
        body: "Wiring new tools into the platforms you already run, so there isn't yet another place to check.",
      },
      {
        title: "Staff enablement",
        body: "Practical guidance so the people doing the work know what the tool is for, where it fails, and when to override it.",
      },
    ],
    pathForward: {
      heading: "A practical path forward",
      intro:
        "You don't need a transformation program to start, and you don't start by buying a tool. These six steps, in this order, work for most small and mid-market organizations. The early ones cost more honesty than money.",
      steps: [
        {
          title: "Create an AI use policy",
          body: "Write down which tools are approved, what data they may touch, and who decides exceptions. One page people actually read beats a binder nobody opens, and it gives every later step something to point to.",
        },
        {
          title: "Run a shadow AI audit",
          body: "Find out what staff are already using before selecting anything new. The gap between approved tools and actual practice shows where help is needed most, and where company information is already going.",
        },
        {
          title: "Form an AI advisory council",
          body: "Build it from the bottom up. The people doing the work know where the friction is, and a small cross-functional group keeps adoption grounded in real workflows instead of vendor demos.",
        },
        {
          title: "Create a roadmap",
          body: "Sequence use cases by readiness and payoff, not by what's in the news. What your security, data, and integration foundations can support today decides what goes first.",
        },
        {
          title: "Prepare the infrastructure",
          body: "Identity and access, data quality, integrations, and security controls determine whether a new tool helps or leaks. Most of the real work lives here, and it pays off across everything that follows.",
        },
        {
          title: "Deploy, measure, manage",
          body: "Roll out carefully, measure against the numbers you chose in advance, and keep managing what the rollout leaves behind so the gains hold instead of fading.",
        },
      ],
      outro:
        "Each step maps to work PulseOne already delivers: policy and audits through advisory, the foundation through our security and data work, and the ongoing half through Managed Business Technology.",
    },
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
      "Strategic technology advisory at PulseOne means an honest assessment of where your technology stands, a roadmap that sequences what to do about it, and a standing review to keep the plan current as things change. It's written for the people approving the budget, not just the people spending it.",
      "The advice comes from a team that also delivers, which keeps our recommendations grounded: if we might have to execute the roadmap ourselves, we size it to what your organization can absorb, not to what looks impressive in a deck and stalls at step three.",
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
        body: "A recurring review with the leadership team, so the plan keeps up with reality instead of aging in a drawer.",
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
          "PulseOne is vendor-neutral and recommends categories of action, not products. We do implement and manage the platforms an organization selects, and we tell you plainly when a recommendation is something we would also deliver, so you can weigh it accordingly.",
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
