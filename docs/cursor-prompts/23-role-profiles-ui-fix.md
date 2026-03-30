# Prompt 23: Role Profiles UI Fix (Custom Tags)

## Context
The backend `Role` model and API (`backend/models/role.py`, `backend/routers/admin.py`) already support arbitrary string arrays for `tags`. This allows flexible, granular filtering of newsletter content.
However, the frontend UI (`frontend/src/app/admin/roles/page.tsx`) currently hardcodes these tags to a fixed `DOMAIN_OPTIONS` array (`AI`, `Security`, `Cloud`, `Finance`, `Leadership`, `Other`) using toggle buttons. This prevents admins from creating roles with specific tags like "M&A", "Supply Chain", or "Zero Trust".

We need to replace the hardcoded toggle buttons with a flexible token/chip input system.

## Instructions for Cursor

1. **Update `frontend/src/app/admin/roles/page.tsx`**
   *   Remove the `DOMAIN_OPTIONS` array.
   *   Replace the tag toggle buttons in both the "New Role" form and the "Edit Role" form with a custom tag input component.
   *   **Tag Input Behavior:**
       *   An input field where the admin can type a tag.
       *   Pressing `Enter` or `,` (comma) should add the tag as a "chip" or "token" below or inside the input area.
       *   Each chip should have an "x" button to remove it.
       *   Prevent adding duplicate tags (case-insensitive).
       *   The component should update the `newTags` or `editTags` state array.
   *   Update the role list display to render these custom tags as small badges, exactly as it currently does.

2. **Seed Specific Role Tags (Optional but Recommended)**
   If there is a seed script for roles, or if you are testing manually, create/update the following standard roles with these specific tags:
   *   **CEO:** Strategy, Innovation, M&A, Risk, Leadership, Growth, Workforce, Regulation
   *   **CFO:** Finance, Cost, Risk, Compliance, Investment, Forecasting, Automation, Audit
   *   **CTO:** AI, Cloud, Architecture, Engineering, Security, Platform, Open Source
   *   **CISO:** Security, Compliance, Risk, Identity, Threat, Governance, Zero Trust
   *   **COO:** Operations, Automation, Workforce, Efficiency, Supply Chain, Process
   *   **CMO:** Marketing, AI, Data, Customer, Brand, Analytics, Personalization

## End-to-End Testing
1. Navigate to the Admin Role Profiles page.
2. Create a new role (e.g., "Supply Chain Director") and type custom tags like "Logistics", "Procurement", and "Automation", pressing Enter after each.
3. Save the role and verify the tags display correctly in the list.
4. Edit the role, remove one tag, add another, and save. Verify the changes persist.
5. Go to the Newsletter Preview sandbox, select this new role, and verify that it correctly filters the promoted content based on these custom tags.
