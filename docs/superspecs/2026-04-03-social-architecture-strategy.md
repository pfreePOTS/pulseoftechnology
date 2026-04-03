# Strategic Architecture Review: Social Posting Module

## Executive Summary
This document outlines the architectural strategy for the PulseOne Social Posting module. The core decision evaluated here is whether to build this as an embedded feature within the existing Pulse of Technology platform, or as a standalone, multi-tenant application that interfaces with Pulse. 

After running a comprehensive GStack CEO and Engineering review, the recommendation is to build the backend as a **standalone, multi-tenant headless service**, while building the frontend as an **embeddable React component library** that can be injected into Pulse of Technology (for the B2B use case) or deployed as a standalone app (for the B2C/Creator use case).

## 1. The Core Problem (CEO Review)
**What are we actually building?**
We are building an AI-driven social growth engine. The value proposition is not just scheduling; it's the *intelligence* behind the posts. 

If we build this strictly inside Pulse of Technology, we limit the total addressable market (TAM) to Pulse users. However, the user explicitly stated: *"I'd like to use it for my personal accounts too, I think. Maybe we can market it separately?"*

This changes the product from a feature to a platform.

**The Decision:**
We must architect this to support multiple brands, multiple users, and multiple entry points. It cannot be hardcoded to Pulse of Technology's specific database schema.

## 2. Architecture Recommendation (Eng Review)

### The "Headless Engine" Approach
Instead of building the social logic directly into the `pulseoftechnology/backend` repository, we should build a separate backend service: `PulseSocialEngine`.

1. **Backend (FastAPI/PostgreSQL):** A standalone, multi-tenant API. It handles OAuth for X and LinkedIn, manages scheduling queues, and houses the AI generation prompts.
2. **The "Data Hook":** The engine exposes a webhook or API endpoint that allows external systems (like Pulse of Technology) to push context into it. Pulse pushes a curated article to the engine; the engine returns a generated thread.
3. **Frontend (React/Next.js Embed):** We build the UI as a set of reusable React components (e.g., `<SocialComposer />`, `<AnalyticsDashboard />`). 

### Why this is the right approach:
- **Separation of Concerns:** Pulse of Technology remains focused on *gathering intelligence*. PulseSocialEngine focuses on *distributing intelligence*.
- **Marketability:** You can spin up `creatorbuddy-killer.com` in one weekend by deploying a simple Next.js wrapper around the `PulseSocialEngine` API, without exposing any of your B2B Pulse of Technology infrastructure.
- **Personal Use:** You can use the standalone app for your personal brand without cluttering the B2B platform.

## 3. Technology Stack Recommendations

### Frontend Platform Choice
The user asked: *"We could use React.Native or flutter or some other technology that works multiplatform?"*

**Recommendation:** Stick to **React / Next.js** for the web application, and use **Capacitor or React Native Web** only if a mobile app is strictly required. 

**Why?**
1. **Speed to Market:** You already use Next.js in Pulse of Technology. Introducing Flutter requires learning a new language (Dart) and ecosystem.
2. **Embeddability:** A React component can be trivially embedded into the existing Pulse of Technology admin dashboard. A Flutter app cannot be easily embedded into a React web app.
3. **The "Creator Buddy" Use Case:** 90% of heavy social media scheduling and "reply guying" is done on desktop. A mobile app is a nice-to-have, but not the MVP.

### API Tier Strategy (X / Twitter)
Based on the provided screenshot, the X API pricing tiers are:
- **Free:** 500 posts/month, read-heavy, 1 req/24hrs on most endpoints.
- **Basic:** $200/month. 15,000 read requests/month, 50,000 write requests/month.

**Recommendation:** 
Start with the **Basic Tier ($200/mo)** for the MVP. 
- The Free tier (500 posts/month) is roughly 16 posts a day. If you have 3 users posting 5 times a day, you max out the API. It is strictly for local testing.
- The Basic tier (50,000 writes/month) supports ~1,600 posts a day. This is more than enough to support you, the Pulse brand, and a beta cohort of 50-100 users.

## 4. Revised Execution Plan

1. **Initialize New Repo:** Create `pfreePOTS/pulse-social-engine` (FastAPI backend).
2. **Multi-Tenant Auth:** Implement basic JWT auth with `tenant_id` scoping from day one.
3. **Build the Core API:** Implement the X API OAuth flow, post scheduling, and the OpenAI prompt pipelines.
4. **Build the React Components:** Create the UI components in a shared package or directly in the new repo.
5. **Integrate with Pulse:** In the main `pulseoftechnology` repo, add a new tab that renders the React components and points to the new `PulseSocialEngine` API URL.

This architecture gives you maximum optionality: it enhances Pulse of Technology immediately, but gives you a fully independent SaaS product ready to launch to the public whenever you choose.
