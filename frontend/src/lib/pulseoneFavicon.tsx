import { ImageResponse } from "next/og";

/** Matches `--color-pulse-red` in `globals.css`. */
export const PULSEONE_FAVICON_RED = "#D5171E";

export function pulseOneFaviconResponse(size: number): ImageResponse {
  const fontSize = Math.round(size * 0.48);
  const borderRadius = Math.round(size * 0.12);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PULSEONE_FAVICON_RED,
          borderRadius,
          color: "#FFFFFF",
          fontSize,
          fontWeight: 700,
          letterSpacing: size <= 32 ? -0.5 : -1,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          lineHeight: 1,
        }}
      >
        PO
      </div>
    ),
    { width: size, height: size },
  );
}
