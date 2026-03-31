"use client";

import { useEffect, useState } from "react";

/** True after mount. Use to skip SSR for form controls that browser extensions mutate (e.g. fdprocessedid), avoiding hydration mismatches. */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
}
