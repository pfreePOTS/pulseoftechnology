import type { ReactNode } from "react";

/**
 * Lightweight SVG motifs for illustrative case-study cards (no raster art per sector).
 * Stroke icons — pair with tinted panels; colours come from Tailwind classes.
 */

function IconFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Branching workflows / sequencing — ops + AI rollout */
export function OpsSequencingIcon({ className }: { className?: string }) {
  return (
    <IconFrame className={className}>
      <circle cx="12" cy="32" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M16 32h12M34 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="40" cy="42" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="54" cy="32" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M44 22l8 10M44 42l8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconFrame>
  );
}

/** Posture / policy / insurer readiness */
export function PostureGovernanceIcon({ className }: { className?: string }) {
  return (
    <IconFrame className={className}>
      <path
        d="M32 12l14 8v14c0 8.5-7 17-14 20-7-3-14-11.5-14-20V20l14-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M24 34l4 4 12-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

/** Layered governance / fractional office */
export function FractionalOfficeIcon({ className }: { className?: string }) {
  return (
    <IconFrame className={className}>
      <rect x="10" y="14" width="44" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M18 34h28M22 42h20M26 50h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <rect x="18" y="38" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
    </IconFrame>
  );
}

export function CaseStudyHeroIcon({
  caseStudyId,
  className,
}: {
  caseStudyId: string;
  className?: string;
}) {
  switch (caseStudyId) {
    case "ops-ai-sequencing":
      return <OpsSequencingIcon className={className} />;
    case "governance-sprint":
      return <PostureGovernanceIcon className={className} />;
    case "fractional-office":
      return <FractionalOfficeIcon className={className} />;
    default:
      return <OpsSequencingIcon className={className} />;
  }
}

/** Panel colours — stable per narrative pattern (not per industry URL permutation). */
export function caseStudyHeroPanelClass(caseStudyId: string): string {
  switch (caseStudyId) {
    case "ops-ai-sequencing":
      return "from-[#019E7C]/[0.13] via-[#F4F8FA] to-[#e8eef2]";
    case "governance-sprint":
      return "from-[#E91D24]/[0.10] via-[#F4F8FA] to-[#e8eef2]";
    case "fractional-office":
      return "from-[#111827]/[0.06] via-[#F4F8FA] to-[#e8eef2]";
    default:
      return "from-[#019E7C]/[0.10] via-[#F4F8FA] to-[#e8eef2]";
  }
}
