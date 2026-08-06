import { ImageResponse } from "next/og";

import { SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PulseOne: managed business technology and advisory since 2002";

/**
 * Default social share card. Satori applies no browser defaults, so every
 * element with multiple children needs an explicit `display`, and Tailwind
 * classes do not apply here — inline styles only.
 *
 * Colors match `globals.css`: pulse-red #d5171e, pulse-teal #019e7c,
 * dark-bg #1e1e1e.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1e1e1e",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", height: 6, width: 200, background: "#d5171e" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: -1.5,
            }}
          >
            Managed business technology
          </div>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#019e7c",
              lineHeight: 1.15,
              letterSpacing: -1.5,
            }}
          >
            for mid-market leaders
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#ffffff" }}>
            PulseOne
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#9a9a9a" }}>{SITE_TAGLINE}</div>
        </div>
      </div>
    ),
    size,
  );
}
