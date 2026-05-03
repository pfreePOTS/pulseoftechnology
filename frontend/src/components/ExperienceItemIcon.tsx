import type { ReactNode } from "react";

import type { ExperienceIconKey } from "@/lib/recommendedPathTypes";

type Props = {
  variant: ExperienceIconKey;
  className?: string;
};

const SW = 2;

/**
 * Line icons for “Our Experience” cards — inherits `currentColor`; wrap with teal text/bg.
 */
export default function ExperienceItemIcon({ variant, className = "size-[26px]" }: Props) {
  const svg = (inner: ReactNode) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {inner}
    </svg>
  );

  switch (variant) {
    case "assessment":
      return svg(
        <>
          <path d="M7 17V11M12 17V8M17 17v-5" opacity={0.95} />
          <path d="M5 20h14" opacity={0.4} />
        </>,
      );
    case "advisory":
      return svg(
        <>
          <circle cx={12} cy={12} r={9} opacity={0.38} strokeDasharray="3 7" />
          <path d="M12 3v18M21 14l-9-7-9 7" />
        </>,
      );
    case "governance":
      return svg(
        <>
          <path d="M7 7h10v13H7z" opacity={0.52} />
          <path d="M9 4h6l1 3H8z" />
          <path d="M10 12h4M10 15h4" opacity={0.45} strokeWidth={1.85} />
        </>,
      );
    case "managed_services":
      return svg(
        <>
          <rect x={4} y={6} width={16} height={5} rx={1.25} opacity={0.95} />
          <rect x={6} y={11.25} width={12} height={4} rx={1.2} opacity={0.72} />
          <rect x={8} y={15.5} width={8} height={4.5} rx={1.15} opacity={0.48} />
        </>,
      );
    case "security":
      return svg(<path d="M12 21s8-3.5 8-9V8l-8-5-8 5v4c0 5.5 8 9 8 9z" />);
    case "cloud_data":
      return svg(<path d="M7 17a4 4 0 0 1 0-8 4.5 4.5 0 0 1 8.4-2.2A5 5 0 1 1 17 17H7z" />);
    case "ai_emerging":
      return svg(
        <>
          <path d="M12 21a9 9 0 0 1-9-9 9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-.7 4" opacity={0.45} strokeDasharray="4 8" />
          <path d="M12 7v10M17 11l-5 3M7 11l5 3" />
        </>,
      );
    case "continuity":
      return svg(
        <>
          <path d="M4 12a8 8 0 0 1 14-6" />
          <path d="M20 9v6h-6" />
        </>,
      );
    case "procurement":
      return svg(
        <>
          <rect x={4} y={5} width={16} height={14} rx={2} opacity={0.42} strokeWidth={1.85} />
          <path d="M9 13l3 4 8-11" opacity={1} strokeWidth={2.3} />
        </>,
      );
    case "default":
    default:
      return svg(
        <>
          <circle cx={12} cy={12} r={9} opacity={0.45} strokeDasharray="5 10" />
          <path d="M12 5v14M19 15l-7-4-7 4M8 13l4 2 4-2M8 17l4 2 4-2" opacity={0.55} strokeWidth={1.75} />
        </>,
      );
  }
}
