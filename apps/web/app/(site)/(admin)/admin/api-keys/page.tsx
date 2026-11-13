import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ApiKeysManager } from "@/components/admin/api-keys-manager";
import { ApiKeyRequestsPanel } from "@/components/admin/api-key-requests";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Data API keys" };

// Always fresh: the point of the page is what a key is spending right now.
export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage() {
  // Developers may read (this is the diagnostic view for "who is making us
  // slow"); every mutation re-asserts superadmin in its server action and
  // again in the backend.
  const user = await requireDeveloper("/admin/api-keys");

  const [list, tiers, usage, requests] = await Promise.all([
    api.adminApiKeys(),
    api.adminApiKeyTiers(),
    api.adminApiUsage(24),
    api.adminApiKeyRequests(),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Keys for the external <strong>Data API (v2)</strong> at{" "}
        <code>api.droptracker.io/v2</code>. A key belongs to one user or one group and can only
        read what that owner could see on the site. Limits come from its tier, and per-key
        overrides beat the tier field by field.
        <br />
        <span className="text-osrs-parchment-dark/50">
          Group admins ask for a key from their group&apos;s API access tab and anyone can ask for
          a personal one at <code>/api-keys</code>; each request opens a support ticket and waits
          here. Keys can also be created directly below or with{" "}
          <code>scripts/mint_api_key.py</code>.
        </span>
      </p>
      <div className="mb-6">
        <ApiKeyRequestsPanel initial={requests.requests} canDecide={user.is_superadmin} />
      </div>
      <ApiKeysManager
        initialKeys={list.keys}
        initialTiers={tiers.length > 0 ? tiers : list.tiers}
        usage={usage}
      />
    </div>
  );
}
