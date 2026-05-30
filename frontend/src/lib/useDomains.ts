"use client";

import { useCallback, useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";
import {
  FALLBACK_DOMAINS,
  type PublicDomain,
  setCachedDomains,
} from "@/lib/domains";

type UseDomainsState = {
  domains: PublicDomain[];
  loading: boolean;
  error: boolean;
  reload: () => void;
};

let inflight: Promise<PublicDomain[]> | null = null;

async function fetchDomains(apiBase: string): Promise<PublicDomain[]> {
  const res = await fetch(`${apiBase}/api/public/domains`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PublicDomain[];
}

export function useDomains(apiBase: string = API_BASE): UseDomainsState {
  const [domains, setDomains] = useState<PublicDomain[]>([...FALLBACK_DOMAINS]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    inflight = fetchDomains(apiBase)
      .then((rows) => {
        setCachedDomains(rows);
        setDomains(rows);
        setError(false);
        return rows;
      })
      .catch(() => {
        setCachedDomains([...FALLBACK_DOMAINS]);
        setDomains([...FALLBACK_DOMAINS]);
        setError(true);
        return [...FALLBACK_DOMAINS];
      })
      .finally(() => {
        setLoading(false);
        inflight = null;
      });
  }, [apiBase]);

  useEffect(() => {
    if (inflight) {
      void inflight.then((rows) => setDomains(rows)).finally(() => setLoading(false));
      return;
    }
    reload();
  }, [reload]);

  return { domains, loading, error, reload };
}
