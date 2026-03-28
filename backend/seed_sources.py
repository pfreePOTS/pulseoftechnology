"""
Seed the sources table with 10 real-world technology RSS feeds.

Run from the project root (inside Docker or with a local .env):

    # Via Docker (recommended)
    docker compose exec backend python -m backend.seed_sources

    # Locally (requires .env with DATABASE_URL)
    cd backend && python -m seed_sources
"""

from .database import SessionLocal
from .models.source import Source, SourceType

SOURCES = [
    {"name": "Wired Tech",          "url": "https://www.wired.com/feed/category/tech/latest/rss"},
    {"name": "TechCrunch",          "url": "https://techcrunch.com/feed/"},
    {"name": "Krebs on Security",   "url": "https://krebsonsecurity.com/feed/"},
    {"name": "Dark Reading",        "url": "https://www.darkreading.com/rss.xml"},
    {"name": "AI News",             "url": "https://www.artificialintelligence-news.com/feed/"},
    {"name": "CIO.com",             "url": "https://www.cio.com/feed/"},
    {"name": "VentureBeat",         "url": "https://venturebeat.com/feed/"},
    {"name": "The Hacker News",     "url": "https://thehackernews.com/feeds/posts/default"},
    {"name": "Bleeping Computer",   "url": "https://www.bleepingcomputer.com/feed/"},
    {"name": "ZDNet",               "url": "https://www.zdnet.com/news/rss.xml"},
]


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        skipped = 0
        for entry in SOURCES:
            exists = db.query(Source).filter(Source.url == entry["url"]).first()
            if exists:
                skipped += 1
                continue
            db.add(Source(name=entry["name"], url=entry["url"], type=SourceType.rss))
            added += 1
        db.commit()
        print(f"Seeded {added} source(s). Skipped {skipped} already-present.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
