import { SiteChrome } from "@/components/site-chrome";
import SiteUnauthorized from "./(site)/unauthorized";

/**
 * Root 401 boundary. Interrupts thrown from LAYOUTS (e.g. requireSuperadmin
 * in admin/layout.tsx) bubble past nested boundaries to the root — same
 * catching rule as not-found — so the root must render the real component;
 * without this file Next serves its default bare "401" page. The (site) copy
 * still catches page-level throws.
 *
 * A wrapper rather than a re-export: the (site) layout does not run out here,
 * so the chrome has to be added explicitly. SiteUnauthorized is the very same
 * client component the (site) boundary renders.
 */
export default function RootUnauthorized() {
  return (
    <SiteChrome>
      <SiteUnauthorized />
    </SiteChrome>
  );
}
