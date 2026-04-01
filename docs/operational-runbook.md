# Pulse of Technology — Operational Runbook

This guide covers how to start the system for the first time, seed the database with real RSS sources, and run the AI pipeline to generate your first batch of topics.

## 1. Initial Setup & Environment

Configure your `.env` file at the **project repository root** (same directory as `docker-compose.yml`), not inside `backend/`. Compose loads this file for all services.

1. From the project root:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your **Anthropic API Key** (`ANTHROPIC_API_KEY`). This is strictly required for the AI pipeline to work. You do *not* need SendGrid or HubSpot keys just to test the ingestion and curation flow.
3. Set a secure `ADMIN_PASSWORD` in the `.env` file (the default is `pulseadmin`).
4. For local development, ensure `NEXT_PUBLIC_API_URL` points at the API as exposed on the host (typically `http://localhost:8100` — see the main README port table).

## 2. Boot the System

Start the Docker containers to bring up PostgreSQL, the FastAPI backend, and the Next.js frontend.

1. From the project root (where `docker-compose.yml` is located):
   ```bash
   docker compose up -d
   ```
2. Verify all three containers are running:
   ```bash
   docker compose ps
   ```
   You should see `pulse_db`, `pulse_backend`, and `pulse_frontend` all showing a status of `Up`.

**Host ports (default):** frontend at `http://localhost:3100`, API at `http://localhost:8100`.

## 3. Run Database Migrations

The database tables need to be created before you can insert any data.

1. Execute the Alembic migrations inside the backend container:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
   You should see output indicating that all revisions (including the recent adoption state and industry position updates) were applied successfully.

## 4. Seed the RSS Sources

The system needs raw data to process. A seed script is included to populate the database with curated RSS feeds (security, IT press, wire services, healthcare IT, public-sector tech, and more).

1. Run the seed script inside the backend container:
   ```bash
   docker compose exec backend python -m seed_sources
   ```
2. You should see an output like: `Seeded 10 source(s). Skipped 0 already-present.`

## 5. Trigger the First AI Ingestion Run

Now that sources exist, you can trigger the ingestion pipeline. This will fetch the latest articles from the RSS feeds and pass them to Claude (Haiku) for scoring, classification, and clustering into Topics.

1. Open your browser and navigate to the Admin Dashboard: `http://localhost:3100/admin`
2. Log in using the password you set in `.env` (or `pulseadmin`).
3. Navigate to the **System Jobs** tab (`/admin/jobs`).
4. Click the **"Run RSS Ingestion Now"** button.
5. *Wait.* This process fetches hundreds of articles and makes an API call to Anthropic for each one. Depending on the volume of news, this first run could take 2–5 minutes.
6. You can monitor the progress by watching the backend logs:
   ```bash
   docker compose logs -f backend
   ```

## 6. Curate Your First Topics

Once the ingestion job finishes, the AI will have grouped the raw articles into Topics. The admin UI follows a **4-step pipeline** (Collection → Trend Discovery → Analysis → Publishing).

1. Open **Trend Discovery** (`http://localhost:3100/admin` — sidebar **“2. Trending”**). You will see topics sorted by urgency score.
2. **Click a topic** to open the **detail drawer**. Review the AI-generated summary and source articles.
3. Click the **pencil icon** to edit positioning: set **Adoption State** and **Industry Positions** (impact/risk per industry) as needed.
4. Go to **Step 4: Publishing** (`http://localhost:3100/admin/newsletter`). In the **Radar Publishing** section, toggle the topic **on** so it appears on the public radar (or use **Publish All** where appropriate).

## 7. View the Radar

Once you have published at least one topic to the radar, it becomes visible to the public site.

1. Navigate to the public frontend: `http://localhost:3100`
2. Use the **Industry** and **Domain** filters in the radar control bar if you want to narrow the view.
3. **Click or tap a star** on the radar to lock the side panel and read the full briefing for that signal (hover previews on desktop).
