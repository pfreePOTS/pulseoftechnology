"""
Seed the topics table with the core PulseOne radar domains.

Re-runnable: if a topic already exists its industry_positions are updated
so you can tweak the data without wiping the database.

Each topic receives all 20 ``INDUSTRY_GRID_LABELS`` sectors: legacy aliases in ``CORE_TOPICS``
(e.g. ``Finance & Banking``) normalize to canonical names; any missing sectors get placeholders
matching topic-level urgency/adoption via ``fill_missing_industry_grid_rows``.

Run from inside Docker:
    docker compose exec backend python -m backend.seed_topics
"""

from __future__ import annotations

from typing import Any

from .database import SessionLocal
from .models.topic import Topic, TopicStatus
from .services.ai_service import (
    _canonical_industry_key,
    _prefer_richer_industry_row,
    fill_missing_industry_grid_rows,
)

# Curated rationales keyed by legacy or canonical strings; normalized before persist.

CORE_TOPICS = [
    {
        "name": "AI and AI agents",
        "domain": "AI",
        "urgency_score": 9.2,
        "adoption_state": "Get Your Hands Around",
        "summary": (
            "Generative AI and autonomous agent frameworks are reshaping knowledge work "
            "at every level of the organisation. CEOs and CTOs must decide now whether "
            "to build, buy, or partner. Why it matters: Early movers are compressing "
            "decision cycles and cutting operational overhead by 30–50% in targeted "
            "functions."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 9.8,
                "adoption_state": "Make the Most Of",
                "rationale": "Tech firms are embedding AI into every product layer; those not at 'Make the Most Of' risk irrelevance within 18 months.",
            },
            "Finance & Banking": {
                "urgency_score": 9.0,
                "adoption_state": "Get Your Hands Around",
                "rationale": "AI-driven fraud detection and hyper-personalised advisory are already live at tier-1 banks, forcing mid-tier firms to accelerate.",
            },
            "Healthcare": {
                "urgency_score": 8.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Diagnostic AI and clinical decision support require FDA/CE clearance cycles; CIOs must begin compliance planning now.",
            },
            "Manufacturing": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "AI-powered predictive maintenance and quality inspection offer quick ROI, but OT integration complexity slows deployment.",
            },
            "Education": {
                "urgency_score": 8.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "AI tutoring and automated grading are disrupting ed-tech; institutions must define AI policy before student adoption outpaces governance.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 8.8,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Personalisation engines and AI-generated content are driving measurable conversion lifts; delayed adoption directly impacts revenue.",
            },
            "Government & Public Sector": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Procurement rules and public accountability constraints slow AI adoption, but agencies piloting document processing AI are gaining efficiency.",
            },
            "Media & Entertainment": {
                "urgency_score": 9.0,
                "adoption_state": "Make the Most Of",
                "rationale": "AI-generated content, dubbing, and recommendation algorithms are already transforming production economics and audience reach.",
            },
            "Energy & Utilities": {
                "urgency_score": 7.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Grid optimisation and predictive maintenance AI offers significant OPEX savings, but legacy SCADA integration requires phased planning.",
            },
            "Other": {
                "urgency_score": 7.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Cross-industry AI adoption is accelerating; organisations without an AI strategy are already falling behind peers.",
            },
        },
    },
    {
        "name": "Identity and access",
        "domain": "Security",
        "urgency_score": 8.8,
        "adoption_state": "Get Prepared For",
        "summary": (
            "Identity is the new perimeter. Credential-based breaches account for over "
            "80% of successful attacks. Zero-trust identity architecture, phishing-resistant "
            "MFA, and privileged access management are now board-level priorities. Why it "
            "matters: A single compromised account can cascade into a full enterprise breach."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 9.0,
                "adoption_state": "Get Your Hands Around",
                "rationale": "SaaS providers face constant credential-stuffing attacks; advanced IAM with continuous authentication is a competitive differentiator.",
            },
            "Finance & Banking": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "Regulatory mandates (PSD2, DORA) require strong customer authentication and privileged access controls with full audit trails.",
            },
            "Healthcare": {
                "urgency_score": 9.2,
                "adoption_state": "Get Your Hands Around",
                "rationale": "HIPAA breaches via compromised clinician credentials are the leading cause of healthcare data incidents; zero-trust is now required.",
            },
            "Manufacturing": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "OT/IT convergence is expanding the privileged identity surface; many manufacturers still rely on shared accounts for plant systems.",
            },
            "Education": {
                "urgency_score": 7.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Universities are high-value targets for nation-state actors; phishing-resistant MFA rollout is overdue across most institutions.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 8.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Payment card data breaches via compromised employee accounts carry PCI DSS penalties; multi-factor enforcement is non-negotiable.",
            },
            "Government & Public Sector": {
                "urgency_score": 9.0,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Nation-state attacks targeting government credentials demand zero-trust identity architecture and hardware security keys for privileged users.",
            },
            "Media & Entertainment": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Content piracy via compromised distribution accounts is rising; RBAC enforcement across streaming platforms is increasingly critical.",
            },
            "Energy & Utilities": {
                "urgency_score": 8.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Critical infrastructure attacks via privileged OT credentials risk physical consequences; identity hygiene is a national security issue.",
            },
            "Other": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Identity-based attacks are sector-agnostic; any organisation with cloud assets needs phishing-resistant MFA as a baseline.",
            },
        },
    },
    {
        "name": "Data governance and protection",
        "domain": "Security",
        "urgency_score": 8.5,
        "adoption_state": "Get Prepared For",
        "summary": (
            "Regulatory pressure (GDPR, CCPA, EU AI Act) and AI training pipelines are "
            "dramatically raising the stakes for data classification, lineage, and consent "
            "management. Why it matters: Non-compliance fines now reach 4% of global annual "
            "revenue, and AI models trained on improperly governed data carry existential "
            "legal risk."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "AI product teams training on customer data face EU AI Act obligations; data lineage tooling is now a product prerequisite.",
            },
            "Finance & Banking": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "BCBS 239 and DORA mandate data quality and lineage standards; leading banks have elevated data governance to C-suite accountability.",
            },
            "Healthcare": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "Patient data used in AI models triggers HIPAA, GDPR, and emerging AI-specific rules simultaneously; governance is both a legal and ethical imperative.",
            },
            "Manufacturing": {
                "urgency_score": 7.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Supply chain data sharing with partners requires clear data contracts and classification; failure exposes trade secrets and triggers NIS2 obligations.",
            },
            "Education": {
                "urgency_score": 8.0,
                "adoption_state": "Get Prepared For",
                "rationale": "FERPA and COPPA require strict governance of student data; AI-powered learning tools amplify the risk of non-compliant data usage.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Personalisation engines processing purchase history and biometric data face CCPA and GDPR enforcement; consent infrastructure is business-critical.",
            },
            "Government & Public Sector": {
                "urgency_score": 9.0,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Public sector AI deployments require explainability and data audit trails; regulators are scrutinising algorithmic decision-making in benefits and justice.",
            },
            "Media & Entertainment": {
                "urgency_score": 7.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "AI-generated content trained on licensed material faces copyright and consent disputes; proactive governance reduces legal exposure.",
            },
            "Energy & Utilities": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Smart meter and grid sensor data constitutes personal data under GDPR; data minimisation and retention policies need urgent review.",
            },
            "Other": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Any organisation using AI must establish data lineage and consent tracking before regulators arrive; proactive governance avoids reactive fines.",
            },
        },
    },
    {
        "name": "Security operations and resilience",
        "domain": "Security",
        "urgency_score": 8.2,
        "adoption_state": "Get Prepared For",
        "summary": (
            "AI-accelerated threat actors are outpacing traditional SOC response times. "
            "Automated detection, AI-assisted triage, and business continuity planning "
            "are moving from best practice to baseline requirement. Why it matters: Mean "
            "time to detect breaches exceeds 200 days for organisations without automated "
            "response playbooks."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Software supply chain attacks targeting CI/CD pipelines require 24/7 automated detection; manual SOC response is no longer sufficient.",
            },
            "Finance & Banking": {
                "urgency_score": 9.2,
                "adoption_state": "Make the Most Of",
                "rationale": "DORA mandates tested incident response and resilience programmes; tier-1 banks run quarterly cyber exercises with regulators present.",
            },
            "Healthcare": {
                "urgency_score": 8.8,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Ransomware against hospital OT/IT systems has caused patient harm; automated response and offline backup strategies are now life-safety issues.",
            },
            "Manufacturing": {
                "urgency_score": 7.8,
                "adoption_state": "Get Prepared For",
                "rationale": "A ransomware hit on an OT network can halt production lines; incident response playbooks must now cover operational recovery, not just IT.",
            },
            "Education": {
                "urgency_score": 6.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Ransomware attacks on universities are rising; many institutions lack basic incident response plans or tested backup restoration procedures.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Peak season DDoS and card-skimming attacks require pre-tested incident response; a 4-hour outage on Black Friday can cost millions.",
            },
            "Government & Public Sector": {
                "urgency_score": 9.0,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Nation-state threat actors require SOC capabilities with threat intelligence sharing; NCSC guidance mandates minimum resilience standards.",
            },
            "Media & Entertainment": {
                "urgency_score": 6.5,
                "adoption_state": "Learn About",
                "rationale": "Content theft and streaming platform DDoS are growing but often under-resourced in security teams; a baseline SOC is the first step.",
            },
            "Energy & Utilities": {
                "urgency_score": 8.8,
                "adoption_state": "Get Prepared For",
                "rationale": "ICS/SCADA attacks can cause physical infrastructure damage; NERC CIP compliance requires documented and tested incident response procedures.",
            },
            "Other": {
                "urgency_score": 6.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "SMEs are increasingly targeted as soft entry points into supply chains; a basic incident response playbook is the minimum viable defence.",
            },
        },
    },
    {
        "name": "Cloud, infrastructure, and endpoint management",
        "domain": "Cloud",
        "urgency_score": 8.0,
        "adoption_state": "Get Your Hands Around",
        "summary": (
            "Multi-cloud complexity, shadow IT, and the proliferation of AI workloads are "
            "straining FinOps and security posture simultaneously. Unified endpoint management "
            "and cloud cost governance are now CFO priorities. Why it matters: Unmanaged cloud "
            "spend represents 30% waste on average; unmanaged endpoints are the #1 ransomware "
            "entry point."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 9.0,
                "adoption_state": "Make the Most Of",
                "rationale": "Cloud-native engineering teams are shifting to platform engineering models; FinOps and developer self-service are competitive requirements.",
            },
            "Finance & Banking": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Regulators now scrutinise cloud concentration risk; banks must map third-party dependencies and enforce data residency controls.",
            },
            "Healthcare": {
                "urgency_score": 7.8,
                "adoption_state": "Get Prepared For",
                "rationale": "Clinical workloads migrating to cloud require HIPAA-compliant architecture and device management for clinical endpoints like tablets and sensors.",
            },
            "Manufacturing": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Industrial IoT devices and SCADA systems are connecting to cloud platforms; unified endpoint visibility is critical before security incidents occur.",
            },
            "Education": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Student-owned and campus-managed devices create a complex endpoint estate; cloud-based MDM reduces IT overhead and improves security posture.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 8.2,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Peak traffic demands require cloud auto-scaling; unoptimised cloud spend during off-peak erodes margins for already thin-margin retailers.",
            },
            "Government & Public Sector": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Government cloud adoption is accelerating post-COVID; sovereign cloud requirements and security classifications add deployment complexity.",
            },
            "Media & Entertainment": {
                "urgency_score": 7.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Content rendering and streaming distribution are ideal cloud-native workloads; studios not leveraging cloud elasticity face cost and speed disadvantages.",
            },
            "Energy & Utilities": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Remote monitoring of distributed energy assets via cloud IoT platforms is accelerating; endpoint security for field devices remains an open challenge.",
            },
            "Other": {
                "urgency_score": 6.5,
                "adoption_state": "Learn About",
                "rationale": "Cloud adoption without governance leads to sprawl and security gaps; organisations should establish a baseline cloud strategy before expanding.",
            },
        },
    },
    {
        "name": "Workflow automation and business systems",
        "domain": "Other",
        "urgency_score": 7.8,
        "adoption_state": "Get Ahead Of",
        "summary": (
            "AI-powered workflow automation is collapsing the distinction between RPA, "
            "BPM, and enterprise software. Agentic AI that can operate across ERP, CRM, "
            "and communication platforms is moving from pilot to production. Why it matters: "
            "Organisations deploying intelligent automation are achieving 2–4x productivity "
            "gains in back-office functions."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Software engineering workflows are being automated end-to-end; CI/CD, code review, and incident response are prime targets for agentic AI.",
            },
            "Finance & Banking": {
                "urgency_score": 8.8,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Loan processing, KYC, and regulatory reporting are high-volume, rules-based workflows where AI automation delivers 60–80% cost reduction.",
            },
            "Healthcare": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Prior authorisation and claims processing automation reduces clinician administrative burden, but integration with legacy EHR systems is complex.",
            },
            "Manufacturing": {
                "urgency_score": 8.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Purchase order and supply chain workflow automation can reduce procurement cycle times by 40%; ERP integration is the primary bottleneck.",
            },
            "Education": {
                "urgency_score": 6.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Admissions, financial aid processing, and student support workflows are ripe for automation; early adopters are reallocating staff to higher-value tasks.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 8.5,
                "adoption_state": "Get Your Hands Around",
                "rationale": "Inventory replenishment, returns processing, and customer service automation directly reduce operational costs in a high-transaction environment.",
            },
            "Government & Public Sector": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "Benefits processing and permit workflows are manual bottlenecks; automation pilots are showing 3x throughput improvements with existing staff.",
            },
            "Media & Entertainment": {
                "urgency_score": 7.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Content metadata tagging, rights management, and distribution workflow automation are reducing time-to-market for new releases.",
            },
            "Energy & Utilities": {
                "urgency_score": 7.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Field work order management and outage response workflows have significant automation potential; legacy asset management systems are the constraint.",
            },
            "Other": {
                "urgency_score": 6.5,
                "adoption_state": "Learn About",
                "rationale": "Intelligent automation tools are now accessible to SMEs; understanding which workflows to automate first determines early ROI.",
            },
        },
    },
    {
        "name": "Compliance, auditability, and third-party risk",
        "domain": "Other",
        "urgency_score": 8.3,
        "adoption_state": "Get Prepared For",
        "summary": (
            "Regulators globally are moving from principles to prescriptive rules on AI, "
            "data residency, and supply-chain security. Third-party risk programmes must "
            "now extend to AI vendors and cloud sub-processors. Why it matters: A single "
            "fourth-party breach can trigger regulatory action and reputational damage "
            "affecting the entire supply chain."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 8.0,
                "adoption_state": "Get Prepared For",
                "rationale": "Software vendors are now subject to EU AI Act and Cyber Resilience Act obligations; product compliance programmes must begin in 2025.",
            },
            "Finance & Banking": {
                "urgency_score": 9.8,
                "adoption_state": "Make the Most Of",
                "rationale": "DORA, Basel IV, and SFDR create overlapping compliance obligations; leading banks have invested heavily in GRC automation and continuous audit.",
            },
            "Healthcare": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "MDR, HIPAA, and AI-specific medical device regulations require documented audit trails; non-compliance risks patient safety and licence to operate.",
            },
            "Manufacturing": {
                "urgency_score": 7.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Product liability and supply chain due diligence (CSDDD) require traceability across tier-2 and tier-3 suppliers; most manufacturers are unprepared.",
            },
            "Education": {
                "urgency_score": 7.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "EdTech vendor risk is rising as student data flows through third-party platforms; formal vendor assessment frameworks are needed urgently.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 7.8,
                "adoption_state": "Get Prepared For",
                "rationale": "PCI DSS 4.0 and payment processor requirements impose stricter third-party controls; merchants face increased liability for sub-processor breaches.",
            },
            "Government & Public Sector": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "Government procurement now mandates supply chain security assessments; NCSC and CISA guidance makes third-party risk a contractual obligation.",
            },
            "Media & Entertainment": {
                "urgency_score": 6.5,
                "adoption_state": "Learn About",
                "rationale": "Content distribution partners and advertising technology vendors are emerging third-party risks; most media organisations lack formal TPRM programmes.",
            },
            "Energy & Utilities": {
                "urgency_score": 8.0,
                "adoption_state": "Get Prepared For",
                "rationale": "NIS2 and NERC CIP extend compliance obligations to OT vendors and managed service providers; utility CISOs must audit their supply chain urgently.",
            },
            "Other": {
                "urgency_score": 6.5,
                "adoption_state": "Learn About",
                "rationale": "Third-party breaches are now the primary attack vector for SMEs; a basic vendor risk questionnaire is the minimum viable control.",
            },
        },
    },
    {
        "name": "Operational technology / IoT / robotics",
        "domain": "Other",
        "urgency_score": 7.5,
        "adoption_state": "Get Ahead Of",
        "summary": (
            "The convergence of IT and OT networks is exposing critical infrastructure to "
            "cyber threats that previously operated in isolation. AI-powered robotics and "
            "smart sensors are accelerating the attack surface alongside productivity gains. "
            "Why it matters: A cyberattack on OT systems can halt physical production lines, "
            "trigger safety incidents, and attract regulatory scrutiny."
        ),
        "industry_positions": {
            "Technology": {
                "urgency_score": 7.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "IoT platform providers must embed security-by-design; ETSI EN 303 645 and proposed EU CRA create new product compliance requirements.",
            },
            "Finance & Banking": {
                "urgency_score": 5.5,
                "adoption_state": "Learn About",
                "rationale": "ATM and branch IoT devices represent a niche but growing attack surface; most banks have limited OT exposure compared to other sectors.",
            },
            "Healthcare": {
                "urgency_score": 7.8,
                "adoption_state": "Get Prepared For",
                "rationale": "Connected medical devices (infusion pumps, imaging systems) are running legacy firmware on hospital networks; FDA now mandates cybersecurity in device approvals.",
            },
            "Manufacturing": {
                "urgency_score": 9.5,
                "adoption_state": "Make the Most Of",
                "rationale": "Industry 4.0 initiatives depend on IIoT and robotics; manufacturers ahead of IT/OT integration are achieving 15–20% OEE improvements.",
            },
            "Education": {
                "urgency_score": 4.5,
                "adoption_state": "Learn About",
                "rationale": "Campus IoT (smart HVAC, access control) is growing but security governance is minimal; a baseline asset inventory is the starting point.",
            },
            "Retail & E-Commerce": {
                "urgency_score": 6.5,
                "adoption_state": "Get Ahead Of",
                "rationale": "Warehouse robotics and smart shelving are delivering measurable efficiency gains; retailers not piloting are ceding fulfilment speed to Amazon-native competitors.",
            },
            "Government & Public Sector": {
                "urgency_score": 8.5,
                "adoption_state": "Get Prepared For",
                "rationale": "Smart city infrastructure and defence-adjacent OT systems are high-value nation-state targets; NIS2 now explicitly covers public sector OT operators.",
            },
            "Media & Entertainment": {
                "urgency_score": 4.5,
                "adoption_state": "Learn About",
                "rationale": "Broadcast and production IoT (smart cameras, automated studios) has limited but growing attack surface; awareness is the first priority.",
            },
            "Energy & Utilities": {
                "urgency_score": 9.8,
                "adoption_state": "Make the Most Of",
                "rationale": "Grid modernisation and renewable integration depend on IIoT at scale; NERC CIP and NIS2 create mandatory OT security requirements for all operators.",
            },
            "Other": {
                "urgency_score": 6.0,
                "adoption_state": "Get Ahead Of",
                "rationale": "IoT adoption is accelerating across all sectors; organisations deploying connected devices must address security governance before incidents occur.",
            },
        },
    },
]


def _industry_positions_for_seed(entry: dict[str, Any]) -> dict[str, Any]:
    """Normalize CORE_TOPICS industry keys onto the 20-label grid and backfill blanks."""
    raw = entry.get("industry_positions") or {}
    merged: dict[str, Any] = {}
    if not isinstance(raw, dict):
        raw = {}

    for key, row in raw.items():
        if not isinstance(row, dict):
            continue
        canon = _canonical_industry_key(str(key))
        if canon is None:
            continue
        if canon in merged:
            merged[canon] = _prefer_richer_industry_row(merged[canon], row)
        else:
            merged[canon] = row

    shell = Topic(
        name=entry["name"],
        domain=entry["domain"],
        subdomain="",
        urgency_score=entry["urgency_score"],
        summary=entry.get("summary") or "",
        status=TopicStatus.selected,
        adoption_state=entry["adoption_state"],
        industry_positions={},
        is_published=False,
    )
    return fill_missing_industry_grid_rows(shell, merged)


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        for entry in CORE_TOPICS:
            existing = db.query(Topic).filter(Topic.name == entry["name"]).first()
            positions = _industry_positions_for_seed(entry)
            if existing:
                existing.industry_positions = positions
                existing.urgency_score = entry["urgency_score"]
                existing.adoption_state = entry["adoption_state"]
                existing.is_published = True
                if entry.get("summary"):
                    existing.summary = entry["summary"]
                updated += 1
            else:
                topic = Topic(
                    name=entry["name"],
                    domain=entry["domain"],
                    subdomain="",
                    urgency_score=entry["urgency_score"],
                    summary=entry["summary"],
                    status=TopicStatus.selected,
                    adoption_state=entry["adoption_state"],
                    industry_positions=positions,
                    is_published=True,
                )
                db.add(topic)
                added += 1

        db.commit()
        print(f"Seeded {added} new topic(s). Updated {updated} existing topic(s).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
