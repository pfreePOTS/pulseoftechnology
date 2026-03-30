# Prompt 26: Radar Sizing, Newsletter Filtering, and Publish Pipeline

## Context & Diagnosis
We need to fix three specific issues with surgical precision. 
1. **Radar Stars are too small:** The SVG paths for the stars in `RadarChart.tsx` are hardcoded to `outerR=8` and `innerR=3.4`. They need to be roughly doubled in size, and pushed further out from the center.
2. **Newsletter filtering returns empty:** In `email_service.py`, if a user's role has tags (e.g., CFO), but the topic's articles don't match those tags, the code does a `continue` and skips the topic entirely. This results in empty newsletters. We must implement a fallback to the most recent articles instead of skipping.
3. **Publishing to Radar is hidden/failing:** The "Publish to Radar" button is currently hidden inside the Topic Editor and only appears *after* a topic is approved. Furthermore, the public Next.js page can fail to fetch from the backend during Server-Side Rendering (SSR) due to Docker networking (`localhost` vs `backend`) and strict CORS rules.

---

## Instructions for Cursor

Please make the following exact code replacements.

### 1. Fix Radar Star Sizing
**File:** `frontend/src/components/RadarChart.tsx`

**Change A (Lines ~110-114):**
Find:
```typescript
function starPath(cx: number, cy: number, outerR = 8, innerR = 3.4): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = degToRad(i * 36 - 90);
    const r = i % 2 === 0 ? outerR : innerR;
```
Replace with:
```typescript
function starPath(cx: number, cy: number, outerR = 14, innerR = 6): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = degToRad(i * 36 - 90);
    const r = i % 2 === 0 ? outerR : innerR;
```

**Change B (Line ~178):**
Find:
```typescript
      const r = Math.max(18, (pt.urgency / 10) * MAX_R);
```
Replace with:
```typescript
      const r = Math.max(30, (pt.urgency / 10) * MAX_R);
```

**Change C (Line ~267):**
Find:
```typescript
            <circle cx={pt.x} cy={pt.y} r={14} fill={pt.color} opacity="0.1" />
            <path
              d={starPath(pt.x, pt.y, 8, 3.4)}
```
Replace with:
```typescript
            <circle cx={pt.x} cy={pt.y} r={24} fill={pt.color} opacity="0.1" />
            <path
              d={starPath(pt.x, pt.y, 14, 6)}
```

---

### 2. Fix Newsletter Article Filtering (Fallback Logic)
**File:** `backend/services/email_service.py`

**Change (Lines ~301-309):**
Find:
```python
                # If no matches, skip this topic entirely for this role
                if not matched:
                    continue
                # Sort by published_at descending, take top 3
                matched.sort(key=lambda a: a.published_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
                selected = matched[:3]
```
Replace with:
```python
                # If no matches, fallback to the most recent articles instead of skipping
                if not matched:
                    candidates.sort(key=lambda a: a.published_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
                    selected = candidates[:3]
                else:
                    # Sort by published_at descending, take top 3
                    matched.sort(key=lambda a: a.published_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
                    selected = matched[:3]
```

---

### 3. Fix CORS and Public Radar Fetch
**File 1:** `backend/main.py`
Find:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Replace with:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins to prevent deployment CORS issues
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**File 2:** `frontend/src/app/page.tsx`
Find:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getPublishedTopics(): Promise<RadarTopic[]> {
  try {
    const res = await fetch(`${API_BASE}/api/topics/published`, {
      cache: "no-store",
    });
```
Replace with:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Use 127.0.0.1 for SSR to bypass Docker/Node IPv6 localhost resolution issues
const SSR_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function getPublishedTopics(): Promise<RadarTopic[]> {
  try {
    const res = await fetch(`${SSR_API_BASE}/api/topics/published`, {
      cache: "no-store",
    });
```

---

## End-to-End Testing
1. **Radar Sizing:** Open the Curation Dashboard -> Radar Preview. The stars should be visibly larger (radius 14 instead of 8) and easier to click/hover.
2. **Newsletter:** Open the Newsletter Simulation Sandbox. Select a Role (e.g., CFO). The newsletter should populate with articles for every topic, falling back to the latest articles if no specific CFO tags were found.
3. **Public Radar:** Go to the Curation Dashboard, click "Edit" on an approved topic, and click the **"Publish to Radar"** button at the bottom. Open the public homepage (`localhost:3000`). The topic should immediately appear on the radar.
