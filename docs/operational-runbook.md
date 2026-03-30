# Pulse of Technology — Operational Runbook

This guide covers how to start the system for the first time, seed the database with real RSS sources, and run the AI pipeline to generate your first batch of topics.

## 1. Initial Setup & Environment

Before starting, ensure your `.env` file is properly configured in the `backend` directory.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and add your **Anthropic API Key** (`ANTHROPIC_API_KEY`). This is strictly required for the AI pipeline to work. You do *not* need SendGrid or HubSpot keys just to test the ingestion and curation flow.
4. Set a secure `ADMIN_PASSWORD` in the `.env` file (the default is `pulseadmin`).

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

## 3. Run Database Migrations

The database tables need to be created before you can insert any data.

1. Execute the Alembic migrations inside the backend container:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
   You should see output indicating that all revisions (including the recent adoption state and industry position updates) were applied successfully.

## 4. Seed the RSS Sources

The system needs raw data to process. A seed script is included to populate the database with 10 curated technology RSS feeds (Wired, TechCrunch, Krebs on Security, etc.).

1. Run the seed script inside the backend container:
   ```bash
   docker compose exec backend python -m seed_sources
   ```
2. You should see an output like: `Seeded 10 source(s). Skipped 0 already-present.`

## 5. Trigger the First AI Ingestion Run

Now that sources exist, you can trigger the ingestion pipeline. This will fetch the latest articles from the RSS feeds and pass them to Claude (Haiku) for scoring, classification, and clustering into Topics.

1. Open your browser and navigate to the Admin Dashboard: `http://localhost:3000/admin`
2. Log in using the password you set in `.env` (or `pulseadmin`).
3. Navigate to the **System Jobs** tab (`/admin/jobs`).
4. Click the **"Run RSS Ingestion Now"** button.
5. *Wait.* This process fetches hundreds of articles and makes an API call to Anthropic for each one. Depending on the volume of news, this first run could take 2–5 minutes.
6. You can monitor the progress by watching the backend logs:
   ```bash
   docker compose logs -f backend
   ```

## 6. Curate Your First Topics

Once the ingestion job finishes, the AI will have grouped the raw articles into Topics.

1. Navigate to the **Curate Topics** tab in the Admin Dashboard (`/admin`).
2. You will see a list of pending topics, sorted by urgency score.
3. Click on a topic to open the Editor.
4. Review the AI-generated Executive Summary (written by Claude Sonnet) and the list of source articles.
5. Set the **Adoption State** and configure the **Industry Positions** (urgency scores per industry).
6. Click **"Approve & Publish"**.

## 7. View the Radar

Once you have approved at least one topic, it will appear on the public radar.

1. Navigate to the public frontend: `http://localhost:3000`
2. Select the topic from the "Choose Topic" dropdown.
3. You should see the stars plotted on the radar according to the industry positions you configured in the admin dashboard.
