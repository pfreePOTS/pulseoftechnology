/**
 * Admin sidebar: each entry maps to backend `page_permissions` slugs.
 * Superusers see all items.
 */
export type AdminNavItem = {
  label: string;
  href: string;
  slug: string;
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: "Collection", href: "/admin/research", slug: "research" },
  { label: "Trending", href: "/admin", slug: "trending" },
  { label: "Daily trends", href: "/admin/trending-daily", slug: "daily_trends" },
  { label: "Analysis", href: "/admin/analysis", slug: "analysis" },
  { label: "Publishing", href: "/admin/publishing", slug: "publishing" },
  { label: "Newsletter", href: "/admin/newsletter", slug: "newsletter" },
  { label: "Inbox", href: "/admin/inbox", slug: "inbox" },
  { label: "Radar Preview", href: "/admin/radar-preview", slug: "radar_preview" },
  { label: "Manage Sources", href: "/admin/sources", slug: "sources" },
  { label: "Subscribers", href: "/admin/subscribers", slug: "subscribers" },
  { label: "Role Profiles", href: "/admin/roles", slug: "roles" },
  { label: "Content Library", href: "/admin/library", slug: "library" },
  { label: "System Jobs", href: "/admin/jobs", slug: "jobs" },
  { label: "AI Performance", href: "/admin/ai-performance", slug: "ai_performance" },
  { label: "Prompt Lab", href: "/admin/prompt-lab", slug: "prompt_lab" },
  { label: "Users", href: "/admin/users", slug: "users" },
  { label: "Settings", href: "/admin/settings", slug: "settings" },
] as const;

export type SessionUser = {
  id: number;
  email: string;
  is_superuser: boolean;
  must_change_password: boolean;
  page_permissions: string[];
};

export function navAllowedForUser(item: AdminNavItem, user: SessionUser): boolean {
  if (user.is_superuser) return true;
  return user.page_permissions.includes(item.slug);
}

/** Pages that can be granted to invited users (excludes Users + Settings). */
export const INVITABLE_NAV: readonly AdminNavItem[] = ADMIN_NAV.filter(
  (n) => n.slug !== "users" && n.slug !== "settings",
);

export function canAccessAdminPath(pathname: string, user: SessionUser): boolean {
  if (user.is_superuser) return true;
  const entry = ADMIN_NAV.find((n) =>
    n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href),
  );
  if (!entry) return true;
  return user.page_permissions.includes(entry.slug);
}
