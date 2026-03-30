# Pulse of Technology — Admin UI & Workflow Fix Prompts

This set of prompts addresses gaps in the admin workflow, specifically around managing already-approved topics, previewing the radar placement, and clarifying the topic editing UI.

---

## Admin Fix 1: Manage Approved Topics (Curation Dashboard Tabs)

**Problem:** The Curation Dashboard (`/admin`) currently only fetches and displays `pending` topics. Since the seed script creates topics as `approved`, they disappear from the dashboard and cannot be edited.
**Task:** Update the Curation Dashboard to support tabs for "Pending" and "Approved" topics.

**Instructions:**
1. **Backend Update (`backend/routers/admin.py`):**
   - Modify `GET /topics` to accept an optional query parameter `status: TopicStatus | None = None`.
   - If `status` is provided, filter by that status. If not, return all topics.
2. **Frontend Update (`frontend/src/app/admin/page.tsx`):**
   - Add a state variable `activeTab` ("pending" | "approved").
   - Add a tab navigation UI above the table to switch between "Pending" and "Approved".
   - Update the fetch call to append `?status=pending` or `?status=approved` based on the active tab.
   - When the "Approved" tab is active, the table should show the seeded/approved topics. The action button should say "Edit" instead of "Review".

---

## Admin Fix 2: Admin Radar Preview Page

**Problem:** Curators need to see how their urgency scores and adoption states translate to actual visual placement on the radar without having to check the public website.
**Task:** Add a "Radar Preview" page to the admin dashboard.

**Instructions:**
1. **Frontend Update (`frontend/src/app/admin/radar-preview/page.tsx`):**
   - Create a new admin page for the Radar Preview.
   - Fetch all approved topics from the existing public endpoint (`GET /api/topics/published`) or the admin endpoint (`GET /api/admin/topics?status=approved`).
   - Reuse the existing `RadarChart` and `RadarSection` components from the public site to render the radar exactly as it appears publicly.
   - Include the "Choose Topic" dropdown to filter the radar, just like the public site.
2. **Navigation Update (`frontend/src/app/admin/layout.tsx`):**
   - Add `{ label: "Radar Preview", href: "/admin/radar-preview" }` to the `NAV` array in the sidebar so it's easily accessible.

---

## Admin Fix 3: Topic Editor UI Enhancements

**Problem:** The Topic Editor (`/admin/topics/[id]/TopicEditor.tsx`) needs clearer controls for the global adoption state and better visibility into how industry positions affect the radar.
**Task:** Enhance the Topic Editor UI.

**Instructions:**
1. **Global Adoption State:**
   - Ensure there is a clear, distinct dropdown for the topic's *Global* `adoption_state` (e.g., "Get Ahead Of", "Learn About", etc.) located near the global Urgency Score slider.
2. **Industry Positions Clarity:**
   - In the Industry Positions section, make it explicitly clear that these are *overrides* to the global state.
   - Ensure the "Add industry..." form allows setting both the specific `urgency_score` AND the specific `adoption_state` for that industry, as both dictate the star's placement on the radar (angle and distance).
   - If the `industry_positions` JSON schema doesn't currently support `adoption_state` per industry, update the backend model and validation to allow it (e.g., `{"Finance": {"urgency_score": 8.0, "adoption_state": "Get Prepared For"}}`). The seed script already uses this format.
3. **Save/Approve Logic:**
   - If a topic is already `approved`, hide the "Approve & Publish" button and only show "Save Changes". Ensure saving an already-approved topic does not change its status back to pending.

**Validation Checklist:**
- [ ] Approved topics (like the seeded ones) are visible and editable in the Curation Dashboard under the "Approved" tab.
- [ ] The Admin Sidebar has a "Radar Preview" link that renders the interactive radar.
- [ ] The Topic Editor allows changing the global Adoption State.
- [ ] The Topic Editor allows setting both Urgency and Adoption State per industry.
