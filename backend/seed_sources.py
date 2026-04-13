"""
Seed the sources table with curated RSS feeds (security, IT, and broader news).

Run from the project root (inside Docker or with a local .env):

    # Via Docker (recommended)
    docker compose exec backend python -m backend.seed_sources

    # Locally (requires .env with DATABASE_URL)
    cd backend && python -m seed_sources
"""

from .database import SessionLocal
from .models.source import Source, SourceType

# One-time URL rewrites for feeds that broke or changed (matches existing rows by old URL)
LEGACY_SOURCE_MIGRATIONS: list[tuple[str, str, str]] = [
    (
        "https://www.wired.com/feed/category/tech/latest/rss",
        "Wired Tech",
        "https://www.wired.com/feed/rss",
    ),
    (
        "https://feeds.reuters.com/reuters/technologyNews",
        "The Guardian — Technology",
        "https://www.theguardian.com/technology/rss",
    ),
    (
        "https://www.govtech.com/rss/top-news",
        "Nextgov",
        "https://www.nextgov.com/rss/all/",
    ),
]

SOURCES = [
    # Main Wired feed (category URL 404s / returns non-XML for automated clients)
    {"name": "Wired Tech", "url": "https://www.wired.com/feed/rss"},
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/"},
    {"name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/"},
    {"name": "Dark Reading", "url": "https://www.darkreading.com/rss.xml"},
    {"name": "AI News", "url": "https://www.artificialintelligence-news.com/feed/"},
    {"name": "CIO.com", "url": "https://www.cio.com/news/feed/"},
    {"name": "VentureBeat", "url": "https://venturebeat.com/feed/"},
    {"name": "The Hacker News", "url": "https://thehackernews.com/feeds/posts/default"},
    {"name": "Bleeping Computer", "url": "https://www.bleepingcomputer.com/feed/"},
    {"name": "ZDNet", "url": "https://www.zdnet.com/news/rss.xml"},
    # Broader news wires + verticals (beyond pure tech blogs)
    # feeds.reuters.com often fails DNS; www Reuters RSS is bot-gated — Guardian tech wire
    {"name": "The Guardian — Technology", "url": "https://www.theguardian.com/technology/rss"},
    {"name": "BBC Technology", "url": "https://feeds.bbci.co.uk/news/technology/rss.xml"},
    {"name": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/"},
    {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index"},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml"},
    {"name": "NPR Technology", "url": "https://feeds.npr.org/1019/rss.xml"},
    {"name": "Healthcare IT News", "url": "https://www.healthcareitnews.com/rss.xml"},
    # GovTech public RSS paths often serve HTML; Nextgov is a stable federal-IT feed
    {"name": "Nextgov", "url": "https://www.nextgov.com/rss/all/"},
    # Enterprise IT, innovation, business press (URLs verified with feedparser)
    {
        "name": "ComputerWeekly — Enterprise software",
        "url": "https://www.computerweekly.com/rss/Enterprise-software.xml",
    },
    {"name": "InformationWeek", "url": "https://www.informationweek.com/rss.xml"},
    {"name": "ZDNet — Business", "url": "https://www.zdnet.com/topic/business/rss.xml"},
    {"name": "Computerworld", "url": "https://www.computerworld.com/feed/"},
    {
        "name": "VentureBeat — Enterprise",
        "url": "https://venturebeat.com/category/enterprise/feed/",
    },
    {"name": "TechCrunch — Enterprise", "url": "https://techcrunch.com/category/enterprise/feed/"},
    {
        "name": "MIT Technology Review — Business",
        "url": "https://www.technologyreview.com/topic/business/feed/",
    },
    {"name": "The Next Web", "url": "https://thenextweb.com/feed"},
    {"name": "Forbes — Innovation", "url": "https://www.forbes.com/innovation/feed/"},
    {"name": "Fortune", "url": "https://fortune.com/feed"},
    {"name": "Network World", "url": "https://www.networkworld.com/feed/"},
    {"name": "ZDNet — Cloud", "url": "https://www.zdnet.com/topic/cloud/rss.xml"},
]


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        skipped = 0
        for old_url, new_name, new_url in LEGACY_SOURCE_MIGRATIONS:
            row = db.query(Source).filter(Source.url == old_url).first()
            if row:
                row.name = new_name
                row.url = new_url
                updated += 1
        for entry in SOURCES:
            by_url = db.query(Source).filter(Source.url == entry["url"]).first()
            if by_url:
                skipped += 1
                continue
            by_name = db.query(Source).filter(Source.name == entry["name"]).first()
            if by_name:
                by_name.url = entry["url"]
                updated += 1
                continue
            db.add(Source(name=entry["name"], url=entry["url"], type=SourceType.rss))
            added += 1
        db.commit()
        print(f"Seeded {added} new, updated {updated}, skipped {skipped} already-present.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
