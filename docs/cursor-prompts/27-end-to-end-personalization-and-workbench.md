# Task: Implement End-to-End Personalization & Marketer's Workbench

## Context

**Feature Description:**
Transition PulseOne from a generic radar broadcast to a true **role-aware intelligence platform**. Currently, the system filters articles by domain tags but does not *translate* the "why it matters" for specific executive personas (e.g., CTO vs. CFO). Additionally, the admin backend is fragmented into disconnected CRUD screens, making it difficult to orchestrate targeted newsletter campaigns.

**Goals:**
1. **Capture Role:** Update the public Subscribe Wizard to capture the user's role.
2. **Sync Persona:** Ensure HubSpot sync includes the user's role.
3. **Admin Role Editing:** Allow admins to view and edit subscriber roles.
4. **Persona-Based AI Translation:** Modify the AI pipeline to generate role-specific "why it matters" impacts instead of a single generic summary.
5. **Marketer's Workbench:** Unify the admin curation, positioning, and newsletter preview screens into a cohesive step-by-step campaign wizard.

---

## Implementation Steps

### Step 1: Database Schema & API Updates for Roles

**Goal:** Update models to support persona-based impacts and allow public role fetching.

**Files to Modify:**
- `backend/models/article.py`
- `backend/routers/public.py`
- `backend/routers/admin.py`

**Changes:**
1. **Article Model:** Add a new column `persona_impacts: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)`. (Keep `why_it_matters` for backwards compatibility or drop it if safe).
2. **Alembic:** Generate a new migration (`alembic revision --autogenerate -m "add persona_impacts to article"`) and apply it.
3. **Public API:** Add a `GET /api/roles` endpoint in `public.py` that returns `id` and `name` (do not expose tags publicly) so the Subscribe Wizard can list them.
4. **Admin API:** Add a `PUT /api/admin/subscribers/{id}/role` endpoint in `admin.py` to update a subscriber's `role_id`.

**Validation:**
- [ ] `alembic upgrade head` succeeds.
- [ ] `GET /api/roles` returns a list of roles.
- [ ] `PUT /api/admin/subscribers/{id}/role` updates the database.

### Step 2: Front-End Data Funnel (Subscribe Wizard & Admin Subscribers)

**Goal:** Capture role during subscription and allow admins to edit it.

**Files to Modify:**
- `frontend/src/components/SubscribeWizard.tsx`
- `frontend/src/app/admin/subscribers/page.tsx`
- `backend/services/hubspot_sync.py`

**Changes:**
1. **SubscribeWizard:** 
   - Fetch roles from `GET /api/roles` on mount.
   - Insert a new Step 2: "Your Role" (dropdown of fetched roles).
   - Shift Industry to Step 3, Domains to Step 4.
   - Include `role_id` in the `POST /api/subscribe` payload.
2. **HubSpot Sync:** 
   - Update `_build_properties` in `hubspot_sync.py` to include `"pulse_role": subscriber.role.name if subscriber.role else ""`.
3. **Admin Subscribers UI:** 
   - Add a "Role" column to the table.
   - Make the role cell a dropdown that calls the new `PUT` endpoint to reassign roles on change.

**Validation:**
- [ ] Subscribe Wizard correctly submits `role_id`.
- [ ] Admin Subscribers page displays roles and updates successfully when changed.

### Step 3: AI Persona-Based Translation

**Goal:** Generate distinct "why it matters" statements for each defined role.

**Files to Modify:**
- `backend/services/ai_service.py`

**Changes:**
1. **Fetch Roles in Pipeline:** In `process_raw_articles`, fetch all active Role names from the database.
2. **Update Summarize Node:** Modify `_node_summarize` and `_SUMMARIZE_NODE_SYSTEM`. Instead of returning a single `why_it_matters` string, instruct Claude to return a JSON object containing `what_is_it` (1-2 sentences) and a `persona_impacts` dictionary mapping each provided role name to a specific 1-2 sentence business impact statement.
   - *Prompt adjustment:* Pass the list of role names into the prompt so Claude knows which personas to write for.
3. **Save Impacts:** Save the resulting `persona_impacts` dict to `article.persona_impacts`.

**Validation:**
- [ ] Run the ingest/process job.
- [ ] Verify the database `articles` table populates `persona_impacts` with keys matching the role names (e.g., `{"CTO": "...", "CFO": "..."}`).

### Step 4: Dynamic Newsletter Assembly

**Goal:** Inject the correct persona impact into the newsletter based on the subscriber's role.

**Files to Modify:**
- `backend/services/email_service.py`

**Changes:**
1. **Update `_build_html`:** When formatting `_ARTICLE_BLOCK`, look up the subscriber's role name.
2. If `article.persona_impacts` exists and has a key matching the subscriber's role name, use that specific text for `why_it_matters`.
3. Fallback to a generic value or the old `why_it_matters` column if the role is missing or the specific impact wasn't generated.

**Validation:**
- [ ] Generate a preview in the Admin Newsletter Sandbox for a CTO vs. a CFO.
- [ ] Verify the "Why it matters" text changes based on the selected role persona.

### Step 5: The Marketer's Workbench (Admin UI Refactor)

**Goal:** Unify the fragmented admin screens into a guided editorial workflow.

**Files to Modify:**
- `frontend/src/app/admin/page.tsx` (Convert to Workbench)
- `frontend/src/app/admin/layout.tsx` (Update navigation)

**Changes:**
1. **Create a Unified Wizard:** Refactor the main `/admin` dashboard into a multi-step tabbed interface (or vertical wizard):
   - **Tab 1: Curation:** The existing pending topics table. (Approve topics here).
   - **Tab 2: Positioning:** A streamlined view of approved topics to adjust Industry Positions and review the AI-generated Persona Impacts.
   - **Tab 3: Promotion:** A quick-select interface to choose which `ContentItem` assets to promote (integrating the Content Library toggle).
   - **Tab 4: Preview & Publish:** Embed the existing Newsletter Sandbox here. Add a final "Dispatch Newsletter" button (moving it from the System Jobs page).
2. **Clean Up Nav:** Remove the redundant sidebar links (Radar Preview, Newsletter Preview) since they are now steps in the Workbench. Keep System Jobs for backend tasks (ingest, signals).

**Validation:**
- [ ] A marketer can seamlessly move from approving topics to previewing the persona-specific newsletter in one fluid UI.
- [ ] "Dispatch Newsletter" correctly triggers the batch send job.

---

## Testing Requirements

### Manual Testing
- [ ] **End-to-End Funnel:** Submit the public Subscribe Wizard with a specific role. Verify the role appears in the Admin Subscribers list.
- [ ] **AI Generation:** Run the AI processing job on a new article. Verify the DB contains `persona_impacts` for multiple roles.
- [ ] **Newsletter Personalization:** Use the Workbench Preview step to toggle between two roles and confirm the article impact text changes accordingly.

## Success Criteria
- [ ] Subscribe Wizard captures role.
- [ ] HubSpot sync includes `pulse_role`.
- [ ] Admin UI allows subscriber role editing.
- [ ] AI generates role-specific impact statements.
- [ ] Newsletter renders the correct impact statement for the subscriber's role.
- [ ] Admin backend provides a unified, step-by-step campaign workbench.
