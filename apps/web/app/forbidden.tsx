import { SiteChrome } from "@/components/site-chrome";
import SiteForbidden from "./(site)/forbidden";

/** Root 403 boundary — see unauthorized.tsx for why the root wrapper exists. */
export default function RootForbidden() {
  return (
    <SiteChrome>
      <SiteForbidden />
    </SiteChrome>
  );
}
