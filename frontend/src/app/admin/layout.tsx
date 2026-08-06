import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";

/**
 * Server layout wrapping the client admin shell so this segment can export
 * metadata. Applies to every `/admin/*` route.
 *
 * `noindex` is set here in addition to the robots.txt disallow in
 * `app/robots.ts`: a disallow rule stops crawling, not indexing, and a URL
 * linked from elsewhere can still be listed without ever being fetched.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
