import type { Metadata, Viewport } from "next";

/*
 * Chromeless shell for the Discord Activity iframe — no site header, ticker or
 * footer (those live in app/(site)/layout.tsx). The shell component owns the
 * viewport (header/tab bar apply their own safe-area insets; edge-to-edge
 * matters on Discord mobile where the iframe extends under notches).
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
  return <div className="min-h-dvh">{children}</div>;
}
