import type { Metadata, Viewport } from "next";

/*
 * Chromeless shell for the Discord Activity iframe — no site header, ticker or
 * footer (those live in app/(site)/layout.tsx). Safe-area padding matters on
 * Discord mobile, where the iframe extends under notches and home indicators.
 */
export const metadata: Metadata = {
  title: "DropTracker Activity",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page draw edge-to-edge so env(safe-area-inset-*) is meaningful.
  viewportFit: "cover",
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }}
    >
      {children}
    </div>
  );
}
