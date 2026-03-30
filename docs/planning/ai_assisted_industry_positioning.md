# AI-Assisted Industry Positioning Design

## The Problem
When curating a topic (e.g., "AI Governance & ROI") for the Pulse of Technology Radar, the curator must decide where to place the star for each of the 6 target industries (Banking/Finance, Healthcare, All Industries, Manufacturing, Technology, SMBs). Doing this manually for every topic is subjective, time-consuming, and difficult to keep consistent.

## The Solution: AI-Assisted Scoring with Human Validation
We will use Claude to analyze the source articles for a topic and generate **suggested urgency scores** and a **rationale** for each industry. The human curator will then review the suggestions, adjust them if necessary, and approve them.

This maintains the "human-in-the-middle" safety requirement while dramatically speeding up the curation process.

### How It Works

1. **The AI Evaluation Prompt:**
   A new function in `ai_service.py` will pass the topic summary and source articles to Claude 3.5 Haiku (or Sonnet) with a specific prompt:
   *"Based on these articles, evaluate the urgency and impact of this topic across these 6 industries: Banking/Finance, Healthcare, Manufacturing, Technology, SMBs/Professional Services, and All Industries. For each, provide a score from 1.0 to 10.0 and a 1-sentence rationale explaining why."*

2. **The Data Structure:**
   The AI returns a JSON object:
   ```json
   {
     "industry_suggestions": {
       "Healthcare": {"score": 8.5, "rationale": "Patient data privacy regulations make AI governance highly urgent."},
       "Manufacturing": {"score": 4.0, "rationale": "Less immediate regulatory pressure compared to data-heavy sectors."}
     }
   }
   ```

3. **The Admin UI Integration:**
   In the Topic Editor (`/admin/topics/[id]`), next to the Industry Positions section, we add a button: **"✨ Generate AI Industry Suggestions"**.
   - When clicked, the UI shows a loading state.
   - The backend calls Claude and returns the suggestions.
   - The UI automatically updates the range sliders to the AI's suggested scores.
   - Crucially, the UI displays the **AI's 1-sentence rationale** directly below each slider so the human curator knows *why* the AI chose that score.

4. **Human Validation:**
   The curator reads the rationale. If they agree, they leave the slider alone. If their editorial judgment differs (e.g., they know a specific manufacturing compliance law the AI missed), they manually drag the slider to adjust the score. When they click "Approve & Publish", the final human-verified scores are saved to the database.

## Strategic Benefits
- **Speed:** Curators don't have to research industry-specific impacts from scratch.
- **Consistency:** The AI provides a baseline grounded in the actual news articles being ingested.
- **Defensibility:** If a client asks "Why is Healthcare an 8.5 on the radar?", the PulseOne team has the AI's rationale saved as a reference point.
- **Safety:** The AI never publishes directly to the radar; it only suggests slider positions in the admin dashboard.
