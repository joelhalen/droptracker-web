import { SiteChrome } from "@/components/site-chrome";

/*
 * Site chrome (ticker + header + footer) lives in the SiteChrome component so
 * chromeless surfaces — the Discord Activity under /activity — can render from
 * the bare root layout without inheriting it, while the root interrupt
 * boundaries (not-found / unauthorized / forbidden), which render outside this
 * layout, can still opt into it. See components/site-chrome.tsx.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
