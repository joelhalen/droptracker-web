import { NotFoundView } from "@/components/not-found-view";
import { SiteChrome } from "@/components/site-chrome";

/*
 * Root 404 boundary — serves every fully-unmatched URL, plus any notFound()
 * that bubbles out of `(site)/layout.tsx` itself. Neither case runs the (site)
 * layout, so the chrome has to be added here or the 404 arrives as a bare card
 * on an empty page. The `(site)` copy renders the same view WITHOUT SiteChrome
 * because it already sits inside that layout.
 */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundView />
    </SiteChrome>
  );
}
