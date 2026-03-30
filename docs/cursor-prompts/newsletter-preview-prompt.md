# Pulse of Technology — Newsletter Preview Prompt

This prompt is designed to be pasted directly into Cursor to build a "dry-run" preview of the daily newsletter. This allows the team to see exactly what the AI has curated and formatted without needing SendGrid configured or sending a real email.

---

## Admin Prompt 6: Newsletter Preview & Dry-Run Mode

**Task:** We need a way to preview the fully rendered HTML of the daily newsletter directly in the admin dashboard before it gets sent out. This preview should use a dummy subscriber profile to show how the dynamic template and AI summaries look in practice.

**Instructions:**

1. **Backend Email Service Update:**
   - Open `backend/services/email_service.py`.
   - Add a new function `generate_newsletter_preview(db: Session) -> str`:
     - Create an in-memory dummy `Subscriber` object (do not add to the database). Example: `first_name="Jane"`, `last_name="Executive"`, `industry="Technology"`, `domains=["AI", "Security", "Cloud"]`.
     - Fetch the currently approved topics that are eligible for today's newsletter (you can use the same `cutoff` logic found in `run_daily_newsletter`, or simply fetch the 5 most recently approved topics).
     - Pass the dummy subscriber and the topics to the existing `_build_html(subscriber, topics)` function.
     - Return the resulting raw HTML string.

2. **Backend API Endpoint:**
   - Open `backend/routers/admin.py`.
   - Add a new endpoint `GET /api/admin/newsletter/preview`.
   - Call `generate_newsletter_preview(db)` and return the raw HTML string. You can return it using FastAPI's `HTMLResponse` so it renders directly in the browser, or wrap it in JSON.

3. **Frontend Preview Page:**
   - Create a new page at `frontend/src/app/admin/newsletter/page.tsx`.
   - Build a UI with a header (e.g., "Daily Newsletter Preview") and a "Refresh Preview" button.
   - Fetch the HTML from the new backend endpoint.
   - Render the returned HTML safely inside an `<iframe>` using the `srcDoc` attribute. This is critical: using an iframe ensures the email's inline CSS (`<body style="background:#0f172a...">`) renders correctly without breaking the admin dashboard's Tailwind layout.

4. **Update Admin Sidebar:**
   - Open `frontend/src/app/admin/layout.tsx`.
   - Add a new navigation link for "Newsletter Preview" (`/admin/newsletter`) to the sidebar menu so the curation team can easily access it.
