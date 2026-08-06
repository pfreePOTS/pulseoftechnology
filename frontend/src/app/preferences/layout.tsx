import type { Metadata } from "next";

/**
 * The preference centre is reached from email links and is scoped to a single
 * subscriber, so it should never be indexed. The page itself is a client
 * component and cannot export metadata, hence this layout.
 */
export const metadata: Metadata = {
  title: "Email Preferences",
  robots: { index: false, follow: false },
};

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
