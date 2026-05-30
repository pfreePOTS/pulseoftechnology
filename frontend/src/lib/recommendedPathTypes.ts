/** Response shape for `GET /api/recommended-path` (matches FastAPI `RecommendedPathOut`). */

export type RecommendedTopicPayload = {
  id: number;
  name: string;
  domain: string;
  summary: string | null;
  urgency_score: number;
};

export type RecommendedContentPayload = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  type: string;
  tags: string[];
};

export const EXPERIENCE_ICON_KEYS = [
  "assessment",
  "advisory",
  "governance",
  "managed_services",
  "security",
  "cloud_data",
  "ai_emerging",
  "continuity",
  "procurement",
  "default",
] as const;

export type ExperienceIconKey = (typeof EXPERIENCE_ICON_KEYS)[number];

export type ExperienceItemPayload = {
  title: string;
  description: string;
  /** AI-chosen semantic icon slug (see PulseOne `_PATH_SYNTHESIS_SYSTEM`). */
  icon?: ExperienceIconKey | string;
};

export type RecommendedWatchStoryPayload = {
  title: string;
  url: string;
  hook: string;
  radar_topic_name: string;
  domain: string;
  /** Article thumbnail from ingest (RSS/OG); shown on the recommended-path watch list. */
  image_url?: string | null;
};

export type SynthesisCardPayload = {
  title: string;
  bullets: string[];
  /** Path (`/api/recommended-path/process-card-images/{industry_slug}/{section_slug}`) — browser resolves via ``absoluteApiUrl``. */
  hero_image_url?: string | null;
};

/** PulseOne in Action — illustrative project vignettes (from recommended-path AI). */
export type EngagementExamplePayload = {
  id: string;
  title: string;
  who?: string;
  provided?: string;
  approach?: string;
  solution?: string;
  how_we_helped?: string;
};

export type RecommendedPathPayload = {
  headline: string;
  synthesis: string;
  /** Server-escaped HTML (paragraph wrap) — safe for dangerouslySetInnerHTML. */
  synthesis_html: string;
  synthesis_cards?: SynthesisCardPayload[];
  experience_items: ExperienceItemPayload[];
  engagement_examples?: EngagementExamplePayload[];
  topics: RecommendedTopicPayload[];
  content_items: RecommendedContentPayload[];
  watch_brief: string;
  watch_posture: string;
  watch_stories: RecommendedWatchStoryPayload[];
};

export type RecommendedPathIntake = {
  region: string;
  industry: string;
  role: string;
  issue: string;
  stage: string;
};
