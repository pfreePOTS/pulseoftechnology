/** Anchor id for the public subscribe section (see `page.tsx`). */
export const SUBSCRIBE_SECTION_ID = "subscribe";

const DOMAIN_PREFILL_KEY = "pulseone_subscribe_domain";

export const SUBSCRIBE_PREFILL_EVENT = "pulseone_subscribe_prefill";

/**
 * Scrolls to the subscribe section. Optionally stores a domain value and
 * notifies SubscribeWizard (same-page) via a custom event.
 */
export function scrollToSubscribe(prefillDomain?: string): void {
  if (typeof document === "undefined") return;
  if (prefillDomain) {
    try {
      sessionStorage.setItem(DOMAIN_PREFILL_KEY, prefillDomain);
    } catch {
      /* private mode / quota */
    }
    window.dispatchEvent(
      new CustomEvent(SUBSCRIBE_PREFILL_EVENT, {
        detail: { domain: prefillDomain },
      }),
    );
  }
  document.getElementById(SUBSCRIBE_SECTION_ID)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/** Read and clear stored domain prefill (SubscribeWizard). */
export function consumeSubscribeDomainPrefill(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const v = sessionStorage.getItem(DOMAIN_PREFILL_KEY);
    if (v) sessionStorage.removeItem(DOMAIN_PREFILL_KEY);
    return v;
  } catch {
    return null;
  }
}
