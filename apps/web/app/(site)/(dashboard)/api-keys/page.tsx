import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { canAdminGroup, requireUser } from "@/lib/auth";
import { ApiAccessPanel } from "@/components/api-access";

export const metadata: Metadata = { title: "API access" };

export const dynamic = "force-dynamic";

/**
 * Personal Data API keys (web163a): a key scoped to the accounts the user has
 * claimed. Group keys are requested from the group's own API access tab, so
 * this page points admins there instead of offering both in one form.
 */
export default async function MyApiAccessPage() {
  const user = await requireUser("/api-keys");
  const [keys, requests] = await Promise.all([api.myApiKeys(), api.myApiKeyRequests()]);
  const adminGroups = user.groups.filter((g) => canAdminGroup(user, g.id));

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-osrs-gold text-2xl font-bold">API access</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          A personal key reads the accounts you have claimed. For a whole clan&apos;s data, ask
          for a group key from the group&apos;s admin pages instead.
        </p>
        {adminGroups.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {adminGroups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}/api` as Route}
                  className="border-osrs-bronze/40 hover:text-osrs-gold-bright rounded border px-3 py-1"
                >
                  {g.name}: API access
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      <ApiAccessPanel
        subject="your account"
        initialKeys={keys.keys}
        initialRequests={requests.requests}
        discordMember={requests.discord_member}
      />
    </div>
  );
}
