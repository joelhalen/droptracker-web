import type { Metadata } from "next";

/*
 * Chrome-less shell for /recap-image/{scope}/{id}/{period} — the page
 * services/recap_image.py screenshots for the Discord embed. No site
 * header/ticker/footer (those live in app/(site)/layout.tsx, which this route
 * deliberately sits outside of). Never indexed; the render token gates access.
 *
 * Mirrors app/board-image/layout.tsx — same reasoning, same shape.
 */
export const metadata: Metadata = {
  title: "Recap image",
  robots: { index: false, follow: false },
};

export default function RecapImageLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
