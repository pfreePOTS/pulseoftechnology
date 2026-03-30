# Pulse of Technology — Core Topics Seed Prompt

This prompt is designed to add a seed script that populates the database with the 8 core radar domains defined in the PulseOne Brand Framework.

---

## Admin Prompt 7: Seed Core Brand Framework Topics

**Task:** We need a seed script to populate the database with the 8 core technology domains from the PulseOne Brand Framework so that the Radar has baseline data immediately.

**Instructions:**

1. **Create the Seed Script:**
   - Create a new file at `backend/seed_topics.py`.
   - Add the following code:

```python
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
    {"name": "Compliance, auditability, and third-party risk", "domain": "Compliance"},
    {"name": "Operational technology / IoT / robotics", "domain": "Other"},
]

# Default industry positions to make them visible on the Radar immediately
DEFAULT_POSITIONS = {
    "Banking / Finance": 8.0,
    "Healthcare": 7.5,
    "All Industries": 6.0,
    "Manufacturing": 5.0,
    "Technology": 9.0,
    "SMBs / Professional Services": 6.5,
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
                adoption_state="Understand It",
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
```

2. **Update the Operational Runbook:**
   - If there is an operational runbook, add a note that `docker compose exec backend python -m backend.seed_topics` can be run to initialize the 8 core brand domains.
