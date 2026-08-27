import type { Metadata } from "next";
import { api } from "@/lib/api";
import { ApiKeysManager } from "@/components/admin/api-keys-manager";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Data API keys" };

// Always fresh: the point of the page is what a key is spending right now.
export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage() {
  // Developers may read (this is the diagnostic view for "who is making us
  // slow"); every mutation re-asserts superadmin in its server action and
  // again in the backend.
  await requireDeveloper("/admin/api-keys");

  const [list, tiers, usage] = await Promise.all([
    api.adminApiKeys(),
    api.adminApiKeyTiers(),
    api.adminApiUsage(24),
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
          Self-serve minting is currently disabled site-wide
          (<code>DATA_API_SELF_SERVE_KEYS</code>), so keys exist only if staff create them here
          or with <code>scripts/mint_api_key.py</code>.
        </span>
      </p>
      <ApiKeysManager
        initialKeys={list.keys}
        initialTiers={tiers.length > 0 ? tiers : list.tiers}
        usage={usage}
      />
    </div>
  );
}
