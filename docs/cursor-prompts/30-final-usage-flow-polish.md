# Cursor Prompt 30: Final Usage Flow & Conversion Polish

## Context
This prompt addresses the final 10 unaddressed items from the original usage flow evaluation. The previous prompts (27, 28, 29) successfully restructured the admin pipeline, implemented the detail drawer, added the publishing hub, and fixed the public radar interactions. However, several critical public-facing UX issues remain—specifically around the Subscribe Wizard styling, conversion copy, and environment configuration.

This prompt is designed to be executed sequentially.

---

## 30-A: Consolidate API_BASE & Fix Port Mismatch (C1 & M2)

### Context
`frontend/src/app/page.tsx` defines its own `API_BASE` and `SSR_API_BASE` inline, defaulting to port `8000`. This conflicts with `frontend/src/lib/api.ts` which correctly defaults to port `8100`.

### Files to Modify
- `frontend/src/app/page.tsx`

### Changes
1. Remove the inline `API_BASE` definition.
2. Import `API_BASE` from `@/lib/api`.
3. Update `SSR_API_BASE` to use the imported `API_BASE` as its final fallback instead of hardcoding `127.0.0.1:8000`.
   ```typescript
   const SSR_API_BASE =
     process.env.SERVER_API_URL ??
     process.env.NEXT_PUBLIC_API_URL ??
     API_BASE; // from lib/api
   ```

### Validation
- [ ] `page.tsx` no longer contains the string `"http://localhost:8000"`.
- [ ] `API_BASE` is imported from `@/lib/api`.

---

## 30-B: Fix Admin Radar Preview Query (C3)

### Context
The admin radar preview page still fetches `?status=selected`. This shows approved topics even if they haven't been published yet, creating a false sense of confidence.

### Files to Modify
- `frontend/src/app/admin/radar-preview/page.tsx`

### Changes
1. Change the fetch URL in `useEffect` from `${API_BASE}/api/admin/topics?status=selected` to `${API_BASE}/api/admin/topics?is_published=true`.

### Validation
- [ ] The preview page only shows topics that have the `is_published` flag set to true.

---

## 30-C: Add Hero Value Proposition (H2)

### Context
The public homepage lacks a compelling value proposition above the fold. The `RadarSection` title is functional ("C-Level Technology Intelligence Radar") but doesn't explain *why* the visitor should care.

### Files to Modify
- `frontend/src/app/page.tsx`

### Changes
1. Add a new Hero section immediately below the Dark Teal Header and above the `RadarSection`.
2. The hero should have a white background, centered text, and generous padding (e.g., `py-16 px-6`).
3. **Headline:** "Technology Intelligence for C-Suite Leaders" (use `#425B76`, text-4xl or 5xl, font-bold).
4. **Subheadline:** "Cut through the noise. Know exactly which emerging technologies matter to your industry, what your posture should be, and when to act." (text-lg, text-gray-600, max-w-3xl mx-auto, mt-4).
5. **CTA Buttons:** Two buttons side-by-side (mt-8):
   - Primary: "Explore the Radar" (scrolls to the radar).
   - Secondary: "Get the Briefing" (scrolls to the subscribe section).

### Validation
- [ ] Hero section renders above the radar.
- [ ] Text clearly explains the value proposition.

---

## 30-D: Restyle Subscribe Wizard to Match Light Theme (H1)

### Context
The `SubscribeWizard.tsx` uses a completely dark theme (`bg-gray-900`, `border-gray-800`, `text-white`) with indigo accents. This looks jarring against the light theme of the homepage.

### Files to Modify
- `frontend/src/components/SubscribeWizard.tsx`

### Changes
1. **Container:** Change `bg-gray-900` to `bg-white`, border to `border-gray-200`, shadow to `shadow-sm`. Change heading text to `#425B76` and subtitle to `text-gray-600`.
2. **Inputs:** Change `bg-gray-800` to `bg-white`, text to `text-gray-900`, border to `border-gray-300`. On focus, use `ring-[#425B76] border-[#425B76]`. Change labels to `text-gray-700`.
3. **Step Indicator:** Change active step from `bg-indigo-600` to `bg-[#425B76]`. Change done steps from `bg-indigo-900 text-indigo-300` to `bg-gray-100 text-[#425B76]`. Change connector lines from `bg-indigo-700` to `bg-gray-200` (or `#425B76` if done).
4. **Domain Cards (Step 4):**
   - Unselected: `bg-white border-gray-200 text-gray-700`.
   - Selected: `bg-[#425B76]/5 border-[#425B76] text-[#425B76]`.
   - All Domains Card: Match the new light theme palette.
5. **Buttons:** Ensure the primary continue/subscribe buttons use `#E91D24` (Pulse Red) or `#425B76` consistently.

### Validation
- [ ] The wizard blends seamlessly into the white background of the homepage.
- [ ] Text is readable (dark text on light background).
- [ ] No dark gray or indigo colors remain.

---

## 30-E: Add Pre-Submit Review Step (H4)

### Context
Users submit the form immediately after selecting domains on Step 4. There is no chance to review their email, role, or industry.

### Files to Modify
- `frontend/src/components/SubscribeWizard.tsx`

### Changes
1. Increase total steps from 4 to 5.
2. Step 4 remains "Domains".
3. **New Step 5 (Review):**
   - Show a summary card:
     - Name: `{first_name} {last_name}`
     - Email: `{email}`
     - Role: `{roleLabel}`
     - Industry: `{industry}`
     - Domains: `{domains.length === 0 ? "All Domains" : domains.join(", ")}`
   - Add an "Edit" button next to each row that jumps back to the relevant step.
4. Move the `handleSubmit` action from the Step 4 button to the new Step 5 button.

### Validation
- [ ] Wizard has 5 steps.
- [ ] Step 5 shows all entered data clearly before submission.

---

## 30-F: Handle 409 Duplicate Email Gracefully (H5)

### Context
If a user subscribes with an email that already exists, the API returns a 409. The UI currently just shows the raw error message in red text.

### Files to Modify
- `frontend/src/components/SubscribeWizard.tsx`

### Changes
1. In `handleSubmit`, catch the 409 status specifically.
2. If 409, set a specific `duplicateEmail` state to true.
3. If `duplicateEmail` is true, render a friendly success-like state instead of an error:
   - Icon: A friendly info or check icon.
   - Title: "You're already subscribed!"
   - Message: "The email **{email}** is already on our list. Keep an eye on your inbox for the next briefing."
   - Action: A button to "Start Over" (resets form) or just close.

### Validation
- [ ] Submitting an existing email shows the friendly "already subscribed" message instead of a red error box.

---

## 30-G: Transform "Published Briefings" into a Conversion Teaser (H3)

### Context
The "Published Briefings" section on the homepage just repeats the exact same cards shown in the radar tooltip, adding no new value and lacking a CTA.

### Files to Modify
- `frontend/src/app/page.tsx`

### Changes
1. Rename the section heading to "Latest Intelligence".
2. Limit the display to only the top 3 or 6 most urgent topics (`topics.slice(0, 3)`).
3. Add a "Read Full Briefing" link to each card that currently does nothing but triggers `scrollToSubscribe(topic.domain)`.
4. Add a large, centered CTA button below the grid: "Subscribe to unlock all {topics.length} briefings" (which scrolls to the subscribe section).

### Validation
- [ ] Section shows fewer cards, making it a teaser rather than an exhaustive list.
- [ ] Clear CTAs drive the user to the subscribe wizard.

---

## 30-H: Explicit Transaction on Topic Approval (29-G carryover)

### Context
The `POST /api/admin/topics/{id}/approve` endpoint in `backend/routers/admin.py` still uses a bare `db.commit()` without a try/except/rollback block.

### Files to Modify
- `backend/routers/admin.py`

### Changes
1. Wrap the state changes and `db.commit()` in a `try/except` block with `db.rollback()`.

```python
    try:
        if latest_signal:
            topic.adoption_state = latest_signal.suggested_state
            latest_signal.status = "approved"

        topic.status = TopicStatus.selected
        db.query(Article).filter(Article.topic_id == topic_id).update(
            {"status": "published"}, synchronize_session=False
        )
        db.commit()
        db.refresh(topic)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
```

### Validation
- [ ] `approve_topic` endpoint has explicit rollback on failure.

---

## 30-I: Update Operational Runbook (M1)

### Context
The `docs/operational-runbook.md` still references old ports (`3000`), old directories (`cd backend` for `.env`), and old UI elements ("Approve & Publish" button).

### Files to Modify
- `docs/operational-runbook.md`

### Changes
1. Update `.env` instructions to clarify it belongs in the project root, not `backend/`.
2. Update port references from `3000` to `3100` (frontend) and `8100` (backend).
3. Update the curation workflow description:
   - Go to "Trend Discovery" (not Curation Dashboard).
   - Click a topic to open the detail drawer.
   - Click the pencil icon to edit positioning.
   - Go to Step 4: Publishing to toggle the topic onto the public radar.
4. Remove references to the "Choose Topic" dropdown on the public page.

### Validation
- [ ] Runbook accurately reflects the current 4-step pipeline and correct ports.
