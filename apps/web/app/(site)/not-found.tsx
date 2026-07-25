import { NotFoundView } from "@/components/not-found-view";

/*
 * 404 boundary for notFound() thrown inside (site) pages — orNotFound() on a
 * by-id load, mostly. The chrome comes from `(site)/layout.tsx`, which still
 * renders (it sits above this boundary), so the view goes in bare; the root
 * copy adds SiteChrome itself for unmatched URLs.
 */
export default function SiteNotFound() {
  return <NotFoundView />;
}
