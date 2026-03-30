# Pulse of Technology — Newsletter Simulation Sandbox Prompt

This prompt upgrades the basic newsletter preview into a fully interactive sandbox, allowing the curation team to test the personalization logic by simulating different subscriber profiles.

---

## Admin Prompt 9: Newsletter Simulation Sandbox

**Task:** Upgrade the existing Newsletter Preview page (`/admin/newsletter`) into a full Simulation Sandbox. Instead of using a hardcoded dummy subscriber, build a control panel where the admin can select an Industry and specific Domain interests. The preview should dynamically update to show exactly which topics that specific subscriber profile would receive.

**Instructions:**

1. **Update Backend API (`backend/routers/admin.py`):**
   - Modify the `GET /api/admin/newsletter/preview` endpoint to accept query parameters:
     - `industry`: Optional string.
     - `domains`: Optional list of strings (FastAPI handles this via `Query(default=[])`).
   - Pass these parameters into the `generate_newsletter_preview` function.

2. **Update Email Service (`backend/services/email_service.py`):**
   - Update the signature: `def generate_newsletter_preview(db: Session, industry: str | None = None, domains: list[str] | None = None) -> str:`
   - Modify the dummy `Subscriber` creation to use the passed `industry` and `domains`. If `domains` is empty, treat it as "All Domains" (which is how the current logic works).
   - The rest of the function remains the same (fetching approved topics, running `assemble_newsletter_topics`, and building the HTML).

3. **Upgrade Frontend UI (`frontend/src/app/admin/newsletter/page.tsx`):**
   - Change the layout to include a "Simulation Controls" sidebar or top panel next to the iframe.
   - Add a select dropdown for **Industry** with options: `Banking / Finance`, `Healthcare`, `Manufacturing`, `Technology`, `SMBs / Professional Services`, `All Industries`.
   - Add a group of checkboxes for **Domain Interests** with options: `AI`, `Security`, `Cloud`, `Compliance`, `Other`.
   - Create React state for these selections.
   - Update the `loadPreview` fetch call to append the selected industry and domains as URL query parameters (e.g., `?industry=Healthcare&domains=AI&domains=Security`).
   - Add a "Run Simulation" button (or use a `useEffect` to auto-refresh when controls change) to fetch and render the updated HTML.
   - Update the subtitle text above the iframe to dynamically reflect the current simulation state (e.g., "Simulating subscriber in Healthcare interested in AI, Security").

**Validation Checklist:**
- [ ] Changing the industry in the dropdown updates the industry label inside the generated email footer.
- [ ] Unchecking a domain (e.g., "Security") removes Security-related topics from the generated email preview.
- [ ] Checking all domains (or leaving them empty) shows all approved topics.
- [ ] The iframe still renders the dark-mode email correctly without breaking the admin layout.
