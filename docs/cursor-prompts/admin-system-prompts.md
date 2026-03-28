# Pulse of Technology — Admin System Prompts

The current codebase has a basic curation dashboard for topics, but it lacks authentication, source management, job control, and subscriber visibility. The following 5 prompts are designed to be pasted directly into Cursor to build out a complete, secure admin system. They should be executed in order.

---

## Admin Prompt 1: Admin Authentication & Security

**Task:** The `/api/admin` endpoints and `/admin` frontend pages are currently completely open to the public. We need to secure them using a simple hardcoded admin password approach suitable for an MVP.

**Instructions:**
1. **Backend Configuration:**
   - Add `admin_password: str = "pulseadmin"` to `backend/config.py` `Settings`.
   - Add `ADMIN_PASSWORD=your_secure_password` to `backend/.env.example`.
2. **Backend Auth Implementation:**
   - Create `backend/dependencies.py` (or add to `admin.py`).
   - Implement a simple HTTP Bearer token or HTTP Basic Auth dependency that checks the provided password against `settings.admin_password`.
   - Apply this dependency to all endpoints in `backend/routers/admin.py` to secure them.
   - Create a new endpoint `POST /api/admin/login` that accepts a password and returns a simple token (or just a success message if using a basic cookie/token approach) to validate credentials.
3. **Frontend Login Page:**
   - Create `frontend/src/app/admin/login/page.tsx` with a simple password input form.
   - On submit, call the login endpoint. If successful, store a flag or token in `localStorage` or a cookie (e.g., `pulse_admin_token`).
   - Redirect to `/admin` on success.
4. **Frontend Protection:**
   - Create `frontend/src/app/admin/layout.tsx`.
   - Add a client-side check (or Next.js middleware) that verifies the presence of the auth token. If missing, redirect the user to `/admin/login`.
   - Ensure the token is passed in the `Authorization` header for all fetch calls to `/api/admin/*`.

---

## Admin Prompt 2: Admin Layout & Navigation Sidebar

**Task:** The admin section needs a proper layout with a persistent sidebar navigation menu so the curator can switch between Topics, Sources, Subscribers, and Jobs.

**Instructions:**
1. **Update Admin Layout:**
   - Modify `frontend/src/app/admin/layout.tsx` to include a two-column layout: a fixed left sidebar (dark theme, e.g., `bg-gray-900`) and a main content area (`bg-gray-50`).
2. **Sidebar Component:**
   - Create a sidebar navigation menu with the following links:
     - **Curate Topics** (`/admin`)
     - **Manage Sources** (`/admin/sources`)
     - **Subscribers** (`/admin/subscribers`)
     - **System Jobs** (`/admin/jobs`)
   - Add a "Logout" button at the bottom that clears the auth token and redirects to `/admin/login`.
   - Highlight the active link based on the current route.
3. **Refactor Existing Pages:**
   - Ensure the existing `frontend/src/app/admin/page.tsx` (Topic list) and `TopicEditor.tsx` fit cleanly into the new main content area without layout breakage.

---

## Admin Prompt 3: Source Management (CRUD)

**Task:** We need a way to view, add, edit, and toggle RSS feeds without touching the database directly.

**Instructions:**
1. **Backend Endpoints:**
   - Add CRUD endpoints to `backend/routers/admin.py` for the `Source` model:
     - `GET /api/admin/sources` (list all sources)
     - `POST /api/admin/sources` (add a new source with `name`, `url`, `type`)
     - `PUT /api/admin/sources/{id}` (update a source, specifically toggling `is_active`)
     - `DELETE /api/admin/sources/{id}` (optional, or just rely on `is_active = False`)
2. **Frontend Page:**
   - Create `frontend/src/app/admin/sources/page.tsx`.
   - Build a table listing all sources showing Name, URL, Type, and a toggle switch for Active/Inactive.
   - Add a "New Source" button that opens a simple modal or inline form to add a new RSS feed URL and Name.
   - Connect the UI to the new backend endpoints.

---

## Admin Prompt 4: System Jobs Control Panel

**Task:** The ingestion and newsletter jobs currently only run on a cron schedule. The admin needs the ability to trigger them manually for testing, onboarding, or off-schedule updates.

**Instructions:**
1. **Backend Endpoints:**
   - In `backend/routers/admin.py`, add two new endpoints:
     - `POST /api/admin/jobs/ingest`: Imports and calls `run_all_sources(db)` synchronously (or kicks off a background task and returns immediately).
     - `POST /api/admin/jobs/newsletter`: Imports and calls `run_daily_newsletter(db)` synchronously (or via background task).
   - Ensure these endpoints return a clear success/failure message.
2. **Frontend Page:**
   - Create `frontend/src/app/admin/jobs/page.tsx`.
   - Build a simple dashboard with two large action cards:
     - **"Run RSS Ingestion Now"**: Explains that this will fetch the latest articles from all active sources and run them through the AI for scoring.
     - **"Send Daily Newsletter Now"**: Explains that this will immediately dispatch the newsletter to all active subscribers based on currently approved topics.
   - Add loading states (spinners) to the buttons while the jobs are running, and show success/error toast notifications when they complete.

---

## Admin Prompt 5: Subscriber Visibility

**Task:** The admin needs to be able to see who has subscribed and what their preferences are, even though HubSpot is the primary CRM.

**Instructions:**
1. **Backend Endpoint:**
   - Add an endpoint to `backend/routers/admin.py`:
     - `GET /api/admin/subscribers`: Returns a list of all subscribers, ordered by newest first. Include `id`, `email`, `first_name`, `last_name`, `industry`, `domains`, `is_active`, and `created_at`.
2. **Frontend Page:**
   - Create `frontend/src/app/admin/subscribers/page.tsx`.
   - Build a data table to display the subscribers.
   - Columns should include: Name, Email, Industry, Domain Interests (displayed as small pill tags), Status (Active/Unsubscribed), and Join Date.
   - Add basic client-side search/filtering by email or industry if possible.
