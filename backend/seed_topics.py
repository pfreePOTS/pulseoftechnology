"""
Seed the topics table with the core PulseOne radar domains.
Run from the project root (inside Docker):
    docker compose exec backend python -m backend.seed_topics
"""
from .database import SessionLocal
from .models.topic import Topic, TopicStatus

# The 8 core domains from the PulseOne Brand Framework
CORE_DOMAINS = [
    {"name": "AI and AI agents", "domain": "AI"},
    {"name": "Identity and access", "domain": "Security"},
    {"name": "Data governance and protection", "domain": "Security"},
    {"name": "Security operations and resilience", "domain": "Security"},
    {"name": "Cloud, infrastructure, and endpoint management", "domain": "Cloud"},
    {"name": "Workflow automation and business systems", "domain": "Other"},
    {"name": "Compliance, auditability, and third-party risk", "domain": "Other"},
    {"name": "Operational technology / IoT / robotics", "domain": "Other"},
]

# industry_positions must use the INDUSTRY_COLORS keys from RadarChart.tsx
# and the IndustryPosition schema: {urgency_score: float, adoption_state: str}
DEFAULT_POSITIONS = {
    "Finance & Banking":          {"urgency_score": 8.0, "adoption_state": "Get Prepared For"},
    "Healthcare":                 {"urgency_score": 7.5, "adoption_state": "Get Prepared For"},
    "Technology":                 {"urgency_score": 9.0, "adoption_state": "Get Your Hands Around"},
    "Manufacturing":              {"urgency_score": 5.0, "adoption_state": "Get Ahead Of"},
    "Government & Public Sector": {"urgency_score": 6.0, "adoption_state": "Get Ahead Of"},
    "Retail & E-Commerce":        {"urgency_score": 6.5, "adoption_state": "Get Ahead Of"},
}

def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        skipped = 0
        for entry in CORE_DOMAINS:
            exists = db.query(Topic).filter(Topic.name == entry["name"]).first()
            if exists:
                skipped += 1
                continue
            
            topic = Topic(
                name=entry["name"],
                domain=entry["domain"],
                urgency_score=7.0,
                summary=f"Strategic focus area for {entry['name']}. This is a pre-seeded topic from the PulseOne Brand Framework.",
                status=TopicStatus.approved,
                adoption_state="Get Prepared For",
                industry_positions=DEFAULT_POSITIONS
            )
            db.add(topic)
            added += 1
        db.commit()
        print(f"Seeded {added} core topic(s). Skipped {skipped} already-present.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
