"""PulseOne Microsoft Marketplace consulting offers for the Content Library.

Focus-area tags use radar domain short labels (AI, Security, Cloud, Storage,
Compliance, Infrastructure) so newsletter assembly can rotate offers with topics.
"""

from __future__ import annotations

MARKETPLACE_TAG = "Marketplace"
CTA_URL = "https://pulseone.com/contact-us/"
IMAGE_DIR = "/marketplace-offers"

# asset_id, title, summary, focus short_labels (+ optional role-friendly tags)
MARKETPLACE_OFFERS: list[dict[str, object]] = [
    {
        "asset_id": "01",
        "title": "Security Baseline Assessment for Microsoft 365",
        "summary": (
            "2-week assessment for 50–500 seat businesses to review Microsoft 365 "
            "security posture, unused security licensing, and prioritized risk gaps."
        ),
        "tags": ["Security", "Compliance", "Microsoft 365", "Risk"],
    },
    {
        "asset_id": "02",
        "title": "Secure Score Review for Microsoft 365",
        "summary": (
            "1-week review of Microsoft Secure Score with top prioritized actions "
            "and an executive findings presentation."
        ),
        "tags": ["Security", "Microsoft 365", "Risk"],
    },
    {
        "asset_id": "03",
        "title": "Identity Security Assessment for Microsoft Entra ID",
        "summary": (
            "2-week Entra ID assessment covering Conditional Access, privileged "
            "accounts, and identity hardening recommendations."
        ),
        "tags": ["Security", "Cloud", "Identity", "Zero Trust"],
    },
    {
        "asset_id": "04",
        "title": "Readiness Assessment for Microsoft Defender for Business",
        "summary": (
            "1-week readiness check for Defender for Business — endpoint posture, "
            "licensing alignment, and a deployment roadmap."
        ),
        "tags": ["Security", "Threat", "Microsoft 365"],
    },
    {
        "asset_id": "05",
        "title": "Endpoint Management Assessment for Microsoft Intune",
        "summary": (
            "2-week Intune readiness assessment covering device management, Autopilot, "
            "and endpoint security policy recommendations."
        ),
        "tags": ["Security", "Cloud", "Infrastructure", "Microsoft 365"],
    },
    {
        "asset_id": "06",
        "title": "Business Premium Value Assessment for Microsoft 365",
        "summary": (
            "1-week assessment helping SMBs maximize Business Premium value across "
            "security, device management, and productivity features."
        ),
        "tags": ["Security", "Cloud", "Microsoft 365", "Cost"],
    },
    {
        "asset_id": "07",
        "title": "Copilot Readiness Assessment for Microsoft 365",
        "summary": (
            "2-week assessment of technical, security, and data readiness to deploy "
            "Microsoft 365 Copilot safely and effectively."
        ),
        "tags": ["AI", "Security", "Microsoft 365", "Innovation"],
    },
    {
        "asset_id": "08",
        "title": "AI Readiness, Security, and Governance Assessment for Microsoft 365",
        "summary": (
            "2-week assessment of AI readiness, security posture, and data governance "
            "before introducing Copilot and AI tools into Microsoft 365."
        ),
        "tags": ["AI", "Security", "Compliance", "Governance", "Microsoft 365"],
    },
    {
        "asset_id": "09",
        "title": "License Utilization Review for Microsoft 365",
        "summary": (
            "1-week audit of Microsoft 365 licensing to cut wasted spend and "
            "right-size subscriptions."
        ),
        "tags": ["Cloud", "Cost", "Microsoft 365", "Efficiency"],
    },
    {
        "asset_id": "10",
        "title": "Environment Optimization Review for Microsoft 365",
        "summary": (
            "2-week review of Microsoft 365 architecture, admin roles, and core "
            "service configuration with a prioritized optimization roadmap."
        ),
        "tags": ["Cloud", "Infrastructure", "Microsoft 365", "Architecture"],
    },
    {
        "asset_id": "11",
        "title": "Governance Assessment for Microsoft Teams and SharePoint",
        "summary": (
            "2-week governance assessment for Teams and SharePoint sprawl, "
            "provisioning, lifecycle policies, and information architecture."
        ),
        "tags": ["Compliance", "Cloud", "Governance", "Microsoft 365"],
    },
    {
        "asset_id": "12",
        "title": "Adoption and Usage Assessment for Microsoft 365",
        "summary": (
            "2-week analysis of Microsoft 365 usage to close training gaps, "
            "reduce shadow IT risk, and drive adoption."
        ),
        "tags": ["Cloud", "Microsoft 365", "Workforce", "Efficiency"],
    },
    {
        "asset_id": "13",
        "title": "Data Protection Readiness Assessment for Microsoft 365",
        "summary": (
            "1-week evaluation of Microsoft 365 backup and recovery posture against "
            "accidental deletion and ransomware risk."
        ),
        "tags": ["Storage", "Security", "Microsoft 365", "Risk"],
    },
    {
        "asset_id": "14",
        "title": "Information Protection Assessment for Microsoft Purview",
        "summary": (
            "2-week Purview assessment covering sensitive data discovery, protection "
            "policies, sensitivity labels, and DLP readiness."
        ),
        "tags": ["Security", "Compliance", "Microsoft 365", "Governance"],
    },
    {
        "asset_id": "15",
        "title": "Cost and Resource Optimization Review for Microsoft Azure",
        "summary": (
            "2-week Azure review to identify wasted spend, right-size resources, "
            "and improve architectural efficiency."
        ),
        "tags": ["Cloud", "Infrastructure", "Cost", "Architecture"],
    },
    {
        "asset_id": "16",
        "title": "Security Posture Assessment for Microsoft Azure",
        "summary": (
            "2-week Azure security assessment covering configuration, vulnerabilities, "
            "identity access, and a prioritized remediation roadmap."
        ),
        "tags": ["Security", "Cloud", "Identity", "Threat"],
    },
    {
        "asset_id": "17",
        "title": "Quick-Win Automation Assessment for Microsoft Power Automate",
        "summary": (
            "1-week assessment to find manual process bottlenecks and top quick-win "
            "Power Automate opportunities with ROI estimates."
        ),
        "tags": ["Cloud", "Infrastructure", "Automation", "Efficiency"],
    },
    {
        "asset_id": "18",
        "title": "Email Security Assessment for Microsoft 365",
        "summary": (
            "1-week review of Microsoft 365 email security — anti-phishing, SPF/DKIM/"
            "DMARC, and Defender for Office 365 policies."
        ),
        "tags": ["Security", "Threat", "Microsoft 365"],
    },
    {
        "asset_id": "19",
        "title": "Compliance and Policy Readiness Assessment for Microsoft 365",
        "summary": (
            "2-week assessment mapping HIPAA/PCI/PII requirements to Microsoft 365 "
            "controls via Intune and Purview."
        ),
        "tags": ["Compliance", "Security", "Governance", "Microsoft 365"],
    },
    {
        "asset_id": "20",
        "title": "Backup and Recovery Readiness Assessment for Microsoft 365",
        "summary": (
            "1-week backup/DR readiness review across Exchange, SharePoint, Teams, "
            "and OneDrive with RTO/RPO gap analysis."
        ),
        "tags": ["Storage", "Security", "Microsoft 365", "Risk"],
    },
    {
        "asset_id": "21",
        "title": "Managed Administration Service for Microsoft 365",
        "summary": (
            "Ongoing Microsoft 365 administration for 50–500 seat businesses — "
            "patching, security monitoring, and user lifecycle management."
        ),
        "tags": ["Cloud", "Security", "Infrastructure", "Operations", "Microsoft 365"],
    },
    {
        "asset_id": "22",
        "title": "Vulnerability Management Assessment for Microsoft Defender",
        "summary": (
            "2-week Defender Vulnerability Management assessment with asset inventory, "
            "severity-ranked findings, and remediation planning."
        ),
        "tags": ["Security", "Threat", "Microsoft 365"],
    },
    {
        "asset_id": "23",
        "title": "App Protection Policy Assessment for Microsoft Intune",
        "summary": (
            "1-week Intune App Protection Policy assessment for BYOD iOS/Android — "
            "protect corporate data without full device enrollment."
        ),
        "tags": ["Security", "Cloud", "Identity", "Microsoft 365"],
    },
]


def offer_image_path(asset_id: str) -> str:
    return f"{IMAGE_DIR}/PulseOne_{asset_id}_promo_1280x720.png"


def offer_tags(raw_tags: list[str]) -> list[str]:
    tags = [MARKETPLACE_TAG, *raw_tags]
    # Stable unique order
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out
