import type { MetadataRoute } from "next";

import { SERVICES, servicePath } from "@/lib/services";
import { absoluteUrl } from "@/lib/site";

type Entry = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
};

/**
 * Public, indexable routes only. `/admin`, `/preferences`, and
 * `/recommended-path` are excluded deliberately — see `robots.ts` and the
 * `noindex` metadata on those segments.
 */
const STATIC_ROUTES: Entry[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/services", priority: 0.9, changeFrequency: "monthly" },
  { path: "/industries", priority: 0.8, changeFrequency: "monthly" },
  { path: "/assessments", priority: 0.8, changeFrequency: "monthly" },
  { path: "/approach", priority: 0.7, changeFrequency: "monthly" },
  { path: "/radar", priority: 0.7, changeFrequency: "daily" },
  { path: "/everyone", priority: 0.6, changeFrequency: "daily" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const serviceRoutes: Entry[] = SERVICES.map((service) => ({
    path: servicePath(service.slug),
    priority: 0.9,
    changeFrequency: "monthly",
  }));

  return [...STATIC_ROUTES, ...serviceRoutes].map(
    ({ path, priority, changeFrequency }) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency,
      priority,
    }),
  );
}
