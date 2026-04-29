# PulseOne Website — Migration Guide v3.0

## Overview

This package contains all code and assets required to reproduce the PulseOne website mockup at version 3.0. The site consists of two pages:

| File | Description |
|------|-------------|
| `index.html` | Homepage — includes hero, navigation, all sections, and the 5-step intake survey with interactive USA map |
| `recommended-path.html` | Recommended Path results page — shown after the user completes the survey and clicks "See Your Recommended Path" |

Both pages are **self-contained single-file HTML documents** — all CSS and JavaScript are embedded inline. No external frameworks, no build tools, no server-side code required.

---

## File Structure

```
pulseone_v3.0/
├── index.html                        # Homepage (main working file)
├── recommended-path.html             # Recommended Path results page
├── pulseone_logo_official.png        # PulseOne logo (white version used in footer)
├── logo.png                          # PulseOne logo (colour version used in nav)
├── hero-bg.png                       # Hero section background image
├── FrontPage_SecurityImage.png       # Hero background for recommended-path.html
├── images/
│   ├── boardroom_presentation.jpg
│   ├── client_meeting.jpg
│   ├── consultation_meeting.jpg
│   ├── people_team.jpg
│   ├── progress_handshake.jpg
│   └── technology_server.jpg
└── MIGRATION_GUIDE_v3.0.md           # This file
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties / variables, Grid, Flexbox) |
| Scripting | Vanilla JavaScript (ES6+) — no jQuery, no frameworks |
| Fonts | Google Fonts — IBM Plex Sans (300, 400, 500, 600, 700) |
| Map | Inline SVG — US state paths derived from Natural Earth GeoJSON, grouped by region |
| Icons | Unicode / emoji characters (no icon library dependency) |

---

## Design Tokens (CSS Variables)

All colours, fonts, and spacing are defined as CSS custom properties at the `:root` level in both HTML files. The canonical set is:

```css
:root {
  --red:       #d5171e;
  --teal:      #13c3bd;
  --dark-bg:   #1e1e1e;
  --darker:    #141414;
  --white:     #ffffff;
  --black:     #111111;
  --gray:      #666666;
  --light-bg:  #f5f5f5;

  --font-main: 'IBM Plex Sans', sans-serif;
  --font-cond: 'IBM Plex Sans', sans-serif;
  --font-body: 'IBM Plex Sans', sans-serif;
  --font-btn:  'IBM Plex Sans', sans-serif;
}
```

---

## Page Sections — index.html

The homepage is divided into the following sections in order:

1. **Navigation** (`<nav class="site-nav">`) — sticky white top bar with logo, nav links, and "Let's Talk" CTA button
2. **Hero** (`<section class="hero-section">`) — full-viewport dark hero with background image, headline, sub-copy, and two CTA buttons
3. **Clients / Trust Strip** (`<section class="clients-section">`) — light background, client logo placeholders
4. **Who We Serve / Industries** (`<section class="industries-section">`) — dark background, industry cards grid
5. **How Can We Help / Survey** (`<section class="goals-section">`) — dark background, 5-step intake survey with interactive USA map
6. **What Leaders Are Reading / Insights** (`<section class="insights-section">`) — light background, article cards
7. **Testimonials** (`<section class="testimonials-section">`) — light background, quote cards
8. **How to Engage Us** (`<section class="engage-section">`) — dark background, 4-step process + CTA card
9. **Footer** (`<footer>`) — dark background, 4-column links grid + copyright bar

---

## The Intake Survey — Technical Notes

The survey is a multi-step flow managed entirely in JavaScript. Key IDs and classes:

| Element | ID / Class | Purpose |
|---------|-----------|---------|
| Map panel | `#survey-map-panel` | Full-width step 0 — shown first, hidden after region selection |
| Detail panel | `#survey-detail-panel` | Two-column layout — hidden until region is selected |
| Map step | `#step-0` | Contains the SVG USA map |
| Industry step | `#step-1` | Multiple-choice industry buttons |
| Role step | `#step-2` | Multiple-choice role buttons |
| Challenge step | `#step-3` | Multiple-choice challenge buttons |
| Open-ended step | `#step-4` | Textarea for free-text situation description |
| Result step | `#step-result` | Confirmation screen with "See Your Recommended Path" CTA |
| Progress bar | `#intake-progress-bar` | Width updated by `goToStep()` |

### Survey JS Flow

```
User clicks map region
  → selectRegion(regionName)
  → hides #survey-map-panel
  → shows #survey-detail-panel
  → calls goToStep(1)

User clicks option button (steps 1–3)
  → records answer in surveyData object
  → calls goToStep(n+1)

User submits step 4 (open-ended)
  → records text in surveyData.situation
  → calls showResult()

showResult()
  → activates #step-result
  → populates result message with region + concern
  → "See Your Recommended Path" links to recommended-path.html

Restart button
  → resets surveyData
  → shows #survey-map-panel, hides #survey-detail-panel
  → calls goToStep(0)
```

### USA Map SVG Structure

The map SVG uses `<g>` groups, one per region. Each group has a `data-region` attribute and a CSS class:

```html
<g class="map-region" data-region="West" id="region-west">
  <!-- individual <path> elements for CA, OR, WA, NV, ID, MT, WY, CO, UT, AK, HI -->
</g>
```

Clicking any path inside a group triggers the region selection. Transparent `<rect>` hit-area overlays are placed over each region to improve click accuracy near state borders.

---

## Page Sections — recommended-path.html

The results page sections in order:

1. **Navigation** — identical to homepage nav
2. **Hero** (`<section class="rp-hero">`) — background image (`FrontPage_SecurityImage.png`), profile tags (Region / Industry / Role / Focus), headline personalised to example profile
3. **What This Means For You** (`<section class="context-section">`) — three insight cards side by side
4. **What Healthcare CEOs Are Reading** (`<section class="insights-section">`) — three article cards matching homepage style
5. **Services Aligned to Your Situation** (`<section class="services-section">`) — 6-card grid, top 2 marked "Top Match"
6. **What Engaging PulseOne Looks Like** (`<section class="process-section">`) — 4-step numbered process
7. **Schedule a Conversation** (`<section class="cta-section">`) — headline, sub-copy, and interactive mock calendar widget
8. **Footer** — identical to homepage footer

### Mock Calendar Widget — Technical Notes

The calendar is rendered entirely in JavaScript. Key elements:

| Element | ID | Purpose |
|---------|----|---------|
| Month/year label | `#cal-month-label` | Updated by `renderCalendar()` |
| Calendar grid | `#cal-grid` | Day cells injected by `renderCalendar()` |
| Time slots panel | `#cal-times` | Populated by `showTimes(date)` |
| Confirm button | `#cal-confirm-btn` | Enabled when both date and time are selected |
| Selected label | `#cal-selected-label` | Shows current selection |

Clicking a valid date calls `showTimes(dateObj)` which renders 30-minute slots from 8:00 AM to 4:30 PM. Some slots are marked unavailable based on a simple day-of-week rule. Clicking a slot sets `selectedTime` and enables the Confirm button.

---

## Deployment

No build step required. To deploy:

1. Copy all files to your web server root (or a subdirectory)
2. Ensure `pulseone_logo_official.png`, `logo.png`, `hero-bg.png`, `FrontPage_SecurityImage.png`, and the `images/` folder are in the **same directory** as the HTML files
3. Serve over HTTP/HTTPS — the files use relative paths for all assets

For local development, run any static file server from the project directory:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| v1.0 | Apr 2026 | Initial homepage mockup |
| v2.0 | Apr 2026 | Interactive USA map survey, two-panel layout, teal map styling |
| v3.0 | Apr 2026 | Recommended Path results page, matching footer, mock calendar, nav cleanup, copy refinements |
