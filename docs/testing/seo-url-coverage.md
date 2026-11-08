# SEO URL coverage (pulseone.com cutover)

Last rebuilt: 2026-11-08 from the live WordPress sitemap and WP REST `posts` collection.

## What this covers

Every public URL Google is likely to know from `https://pulseone.com/sitemap.xml`, classified into:

| Bucket | Action after DNS cutover |
|--------|--------------------------|
| App-native | Served by this Next.js app (`/`, `/assessments`, …) |
| Marketing / geo / privacy redirects | `LEGACY_REDIRECTS` in `frontend/src/lib/legacyRedirects.ts` |
| Apex blog posts (82) | `APEX_BLOG_REDIRECTS` in `frontend/src/lib/apexBlogRedirects.ts` |
| Accepted drops | Intentional 404 after cutover |
| LearnDash / assignment noise | Left as 404 (`/assignment/*`, `/courses/*`, quizzes) |

## Apex posts (82)

Source of truth: `GET https://pulseone.com/wp-json/wp/v2/posts` (`X-WP-Total: 82`).

| Outcome | Count | Destination |
|---------|------:|-------------|
| Exact HubSpot slug match | 41 | `https://blog.pulseone.com/<slug>` |
| Verified content rename | 1 | `/tech-talk-best-practices-…` → `…/7-best-practices-for-layered-cybersecurity` |
| Already in marketing redirect table | 3 | Managed-IT cluster (`business-continuity-solutions`, `it-operations-outsourcing`, `remote-workforce-solutions`) |
| Partner / vendor landings | 9 | `/approach` |
| No HubSpot twin | 28 | `https://blog.pulseone.com` |

Automated check: `frontend/src/lib/legacyRedirects.test.ts` loads `apexWordpressPosts.fixture.json` and asserts every post path is in `LEGACY_REDIRECTS`.

## Accepted drops (404 after cutover)

`/thrive`, `/thrive-login`, `/thrive-registration`, `/thrive-special-access`, `/courses`, `/profile`, `/profile-2`, `/profile-3`, `/reset-password`, `/reset-password-2`, `/registration-2`, `/grow-with-confidence`, `/hubspot-blog-post-test`, `/framework_process`, `/appointment-confirmation`, `/upcoming-events`

Also left as 404: LearnDash trees under `/assignment/`, `/courses/…/lessons/…`, and `/quizzes/week-10-quiz`.

## Search Console note

This repo cannot call Google Search Console. Before DNS cutover, export **Pages → Indexed** (or Coverage) for `pulseone.com` and confirm every URL is:

1. in `LEGACY_REDIRECTS`, or
2. an app-native path this site already serves, or
3. on the accepted-drop / noise list above.

If GSC shows a URL outside those three buckets, add a redirect before flipping DNS.

## Production env (already set)

- `NEXT_PUBLIC_SITE_URL=https://pulseone.com`
- `NEXT_PUBLIC_ROBOTS_INDEX=false` until DNS points at this app
- Custom domains `pulseone.com` and `www.pulseone.com` registered in Railway (DNS still pending)
