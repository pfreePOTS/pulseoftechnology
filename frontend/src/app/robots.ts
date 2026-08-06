import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * AI answer engines are allowed on public routes so PulseOne can be cited in
 * ChatGPT, Claude, Perplexity, and Gemini answers. The rule duplicates the
 * wildcard on purpose: it records a deliberate decision, so a future reader
 * does not mistake the absence of a rule for an oversight.
 *
 * `Google-Extended` is a control token rather than a crawler. Disallowing it
 * would affect Gemini only, never Google Search ranking.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
];

// Robots paths match by prefix, so `/admin` already covers `/admin/anything`.
const DISALLOW = [...PRIVATE_PATHS, "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
