# Pulse of Technology — AI-Assisted Industry Positioning Prompt

This prompt adds an AI-assist feature to the Topic Editor so curators can automatically generate suggested industry positions (radar star placements) based on the source articles.

---

## Admin Prompt 8: AI-Assisted Industry Positioning

**Task:** We need to add a "Generate AI Industry Suggestions" button to the Topic Editor. When clicked, it should call Claude to evaluate the topic's source articles and suggest a 1-10 score and a 1-sentence rationale for each of our 6 target industries. The UI should update the sliders with these suggestions and display the rationale.

**Instructions:**

1. **Update `backend/services/ai_service.py`:**
   - Add a new async function `suggest_industry_positions(topic_id: int, db: Session)`.
   - Fetch the topic and its associated `SourceArticle`s.
   - Use the Anthropic API (Claude 3.5 Haiku is fine) with `response_format={"type": "json_object"}` (or equivalent structured output depending on the SDK version).
   - Prompt: *"You are a technology advisor. Based on the following topic summary and source articles, evaluate the urgency and impact of this topic across these 6 industries: Banking / Finance, Healthcare, Manufacturing, Technology, SMBs / Professional Services, and All Industries. For each, provide a 'score' from 1.0 to 10.0 and a 'rationale' (1 sentence explaining why). Return a JSON object with the key 'industry_suggestions' containing the industry names as keys."*
   - Return the parsed JSON.

2. **Add API Endpoint in `backend/routers/admin.py`:**
   - Add a new `POST /admin/topics/{topic_id}/suggest-industry-positions` endpoint.
   - Call the new `ai_service` function and return the suggestions.

3. **Update `frontend/src/app/admin/topics/[id]/TopicEditor.tsx`:**
   - In the "Industry Positions" section, add a button: `✨ Generate AI Industry Suggestions`.
   - Add a loading state while the request is pending.
   - When the API returns, update the local state for `industry_positions` with the suggested scores so the sliders move automatically.
   - Add a new state variable to store the `rationales`.
   - Below each industry slider, display the AI's rationale text (e.g., in a small, italicized, muted text block) so the curator knows why the AI suggested that score.
   - The user still needs to click "Save Changes" to persist these to the database (human-in-the-middle validation).

**Validation Checklist:**
- [ ] Clicking the button shows a loading state.
- [ ] The sliders automatically update to the AI's suggested scores.
- [ ] A 1-sentence rationale appears below each slider.
- [ ] Saving the topic persists the new scores to the database.
database.
