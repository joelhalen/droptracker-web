import type { Metadata } from "next";
import { api } from "@/lib/api";
import { DiscordRelayManager } from "@/components/admin/discord-relay-manager";
import { requireDeveloper } from "@/lib/auth";

export const metadata: Metadata = { title: "Discord relay" };

// Always fresh: the useful part of the page is whether a bot is polling now.
export const dynamic = "force-dynamic";

export default async function AdminDiscordRelayPage() {
  // Developers may look; every change re-asserts superadmin in its server
  // action and again in the backend (same split as /admin/api-keys).
  await requireDeveloper("/admin/discord-relay");
  const list = await api.adminDiscordRelays();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        A relay lets a group&apos;s <strong>own Discord bot</strong> post DropTracker&apos;s
        messages in its server instead of our bot. Layouts, channels and toggles stay on the site.
        Their bot signs in with a Data API key and makes every Discord call itself, so we never hold
        its token.
        <br />
        <span className="text-osrs-parchment-dark/50">
          New relays start paused. Activate one once its bot is polling. Pausing hands posting
          straight back to our bot. Not offered to users yet.
        </span>
      </p>
      <DiscordRelayManager initial={list.integrations} />
    </div>
  );
}
