# AI Topic Discovery & Industry Impact Model

This document explains how the system automatically discovers new trending topics from raw news feeds, and how those topics are mapped to specific industries on the Radar.

---

## 1. The AI Topic Discovery Pipeline

Currently, the system ingests articles and groups them broadly by "Domain" (e.g., all AI articles go into an "AI" bucket). To provide real value, the AI needs to identify specific **Trending Topics** (e.g., "EU AI Act Compliance", "DeepSeek Market Impact") and group articles into those specific buckets.

### How It Works
1. **Ingestion:** The system pulls hundreds of raw articles daily from trusted RSS feeds.
2. **Article Scoring:** Claude Haiku reads each article and scores it for C-level relevance and urgency (1-10). Irrelevant articles are discarded.
3. **Dynamic Clustering:** Instead of just tagging an article with a Domain, Claude compares the article to recent news and groups it into a specific **Trending Topic**. If a topic doesn't exist yet, the AI creates a new one.
4. **Topic Intelligence Dashboard:** A new admin screen where curators can see a live, clickable list of all AI-discovered Trending Topics, sorted by how many articles are in them and their average urgency. 
5. **Promotion:** The curator clicks a Trending Topic, reads the grouped articles, and clicks "Promote to Radar". This turns the raw trend into an official curated Topic that can be edited and published.

**Why Domain still matters:** "Domain" (AI, Security, Cloud) is used to color-code the badges in the newsletter and UI, but it is *not* the topic itself. The topic is the specific news event or trend.

---

## 2. The Industry Impact Model

A technology trend does not impact every industry equally. As you noted, a heavily regulated industry like Healthcare might face massive risk from a new data policy, while Manufacturing might see minimal impact. 

The system handles this granularity using a two-axis per-industry mapping system.

### The Two Variables (Per Industry)
For every approved Topic, the curator can set two specific values for each of the 6 target industries:
1. **Urgency Score (1.0 to 10.0):** This determines how close the star is to the center of the radar. A score of 10 means "maximum impact/risk" (bullseye).
2. **Adoption State (e.g., "Get Ahead Of", "Learn About"):** This determines which slice (angle) of the radar the star sits in.

### How the AI Helps
In the Topic Editor, the curator clicks **"✨ Generate AI Industry Suggestions"**. 
- The AI reads all the source articles for the topic.
- It evaluates the specific regulatory, financial, and operational risks for Healthcare, Finance, Manufacturing, etc.
- It returns a suggested Urgency Score (1-10 slider) and Adoption State for each industry, along with a 1-sentence rationale.

### The Curator's Workflow
1. The curator opens the "EU AI Act" topic.
2. They click the AI Suggestion button.
3. The AI suggests:
   - **Finance:** Urgency 9.0, State: "Get Prepared For" (Rationale: SEC is heavily scrutinizing AI models).
   - **Manufacturing:** Urgency 4.0, State: "Learn About" (Rationale: Less immediate regulatory pressure).
4. The UI displays these as **sliders and dropdowns**. The curator can manually drag the Finance slider to 9.5 if they disagree with the AI.
5. Once saved, the Radar will plot a Blue star (Finance) close to the center in the "Get Prepared For" slice, and an Orange star (Manufacturing) far from the center in the "Learn About" slice.

This system provides exactly the granularity needed to make the Radar a precise, industry-specific advisory tool, while using AI to do the heavy lifting of initial research.
