import type { Metadata } from "next";

/*
 * Chrome-less shell for the /board-image/{id} export route — the page the
 * Discord bot screenshots. No site header/ticker/footer (those live in
 * app/(site)/layout.tsx, which this route deliberately sits outside of). Never
 * indexed; the render token gates access to any real data.
 */
export const metadata: Metadata = {
  title: "Board image",
  robots: { index: false, follow: false },
};

export default function BoardImageLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
