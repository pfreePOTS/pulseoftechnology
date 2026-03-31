# Pipeline Structural Analysis & Recommendations

## The Intended Editorial Flow

Based on the product vision, the system should follow a distinct 4-step funnel:

1. **Collection (Research):** Fetching hundreds of raw articles from RSS feeds across various technology domains over time (30/60/90 days).
2. **Trending (Signals):** Analyzing those collected articles to identify emerging trends, clustering them into topics, and measuring velocity/acceleration.
3. **Analysis (Positioning):** Evaluating the risk and adoption state of those trending topics across different industries (e.g., "Get Ahead Of" for Healthcare vs "Learn About" for Retail).
4. **Publishing (Radar & Newsletter):** Moving fully analyzed topics onto the public Radar, which then drives the personalized newsletter sent to subscribers based on their role and industry.

## The Current Implementation Gaps

The codebase currently blurs these steps, causing the confusion you noted between the "Research" and "Signals" pages.

### 1. The "Research" Page is Actually the "Trending" Page
- **Current State:** The page at `/admin` is called "Curation Dashboard" or "Research" in the UI, but it actually displays **Topics** (clusters of articles), not the raw articles themselves. It lists AI-discovered trends (Pending) and allows admins to approve them.
- **The Confusion:** You expect a "Research" page to show the raw firehose of collected articles. Instead, the system currently hides the raw articles entirely—they are fetched, clustered into topics, and embedded in the background via the `ingestion.py` job. The UI only surfaces the resulting *topics*.
- **Gap:** There is no UI to view the raw "Collection" (Step 1). The "Research" page is already doing "Trending" (Step 2).

### 2. The "Signals" Page Overlaps with Topic Approval
- **Current State:** The Signals page (`/admin/signals`) looks at *already approved* topics and recommends upgrading their adoption state (e.g., moving from "Learn About" to "Get Ahead Of") based on article velocity.
- **The Confusion:** The "Research" page asks you to approve a topic, but the "Signals" page is where the actual intelligence about its momentum lives. 
- **Gap:** The intelligence (velocity, acceleration, AI rationale) is disconnected from the initial curation decision. A user has to approve a topic blind on one page, then go to another page to see if it's actually trending fast enough to warrant a change.

### 3. Analysis by Industry is Hidden
- **Current State:** The AI generates industry-specific positioning (Step 3), but this is buried inside the individual `TopicEditor` screen (`/admin/topics/[id]`). 
- **Gap:** There is no high-level view to compare risk and adoption states across industries before publishing.

### 4. Publishing is a Disconnected Job
- **Current State:** Publishing to the Radar is a toggle inside the `TopicEditor`. Sending the newsletter is a manual button on the `Jobs` page.
- **Gap:** Step 4 is fragmented. There is no unified "Publish" action that finalizes the Radar and stages the Newsletter.

## Architectural Recommendations

To align the app with your mental model, we need to rename and restructure the admin navigation and views to strictly follow the 4-step pipeline.

### Proposed Admin Navigation Structure

1. **Step 1: Raw Research (New Page)**
   - **Purpose:** View the raw firehose of ingested articles before they are clustered.
   - **Data:** `Article` model where `status == raw` or `processed`.
   - **Action:** Allow admins to manually flag interesting articles or just monitor the feed health.

2. **Step 2: Trend Discovery (Rename current `/admin`)**
   - **Purpose:** Review AI-clustered topics and their velocity signals.
   - **Change:** Merge the "Signals" data directly into this table. When reviewing a pending topic, the admin should immediately see its velocity score and the AI's rationale for why it's trending.
   - **Action:** Approve a trend for deeper analysis.

3. **Step 3: Industry Analysis (New View)**
   - **Purpose:** Review the risk and adoption state for approved trends across the 6 target industries.
   - **Data:** `Topic.industry_positions`.
   - **Action:** Adjust the AI's suggested adoption states (e.g., change "Learn About" to "Get Prepared For").

4. **Step 4: Radar & Dispatch (The Workbench)**
   - **Purpose:** The final gate. Review the updated Radar visualization and the personalized Newsletter previews.
   - **Action:** Click "Publish & Send" to update the public site and dispatch the emails.

## Next Steps

I will generate a Cursor prompt that instructs the AI coder to:
1. Rename the current "Research" page to "Trend Discovery".
2. Merge the velocity/acceleration data from the `signals` endpoint into the `topics` endpoint so the intelligence is visible during curation.
3. Create a simple "Raw Research" view to expose the underlying article firehose.
4. Update the layout navigation to reflect the 1-2-3-4 pipeline explicitly.
