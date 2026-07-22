import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { EmbedEditor } from "@/components/embed-editor";
import { EventLayoutEditor } from "@/components/event-layout-editor";

export const metadata: Metadata = { title: "Discord embeds" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

// Access is gated by the (admin)/groups/[id] layout; the custom_embeds
// entitlement is gated here (and re-checked in the Server Action + Web API).
export default async function GroupEmbedsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events

  const eventsTab = tab === "events";

  const [subscription, tiers, user] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);
  const [embeds, eventLayouts, layoutMeta] = await Promise.all([
    eventsTab ? null : api.groupEmbeds(groupId).catch(() => null),
    eventsTab ? api.groupEventLayouts(groupId).catch(() => null) : null,
    eventsTab ? api.eventLayoutMeta().catch(() => null) : null,
  ]);

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
    }`;

  return (
    <div>
      <div className="border-osrs-bronze/30 mb-4 inline-flex gap-1 rounded-lg border p-1">
        <Link href={`/groups/${groupId}/embeds`} className={tabClass(!eventsTab)}>
          Notifications
        </Link>
        <Link href={`/groups/${groupId}/embeds?tab=events`} className={tabClass(eventsTab)}>
          Event messages
        </Link>
      </div>

      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        {eventsTab ? (
          <>
            Customize the Discord messages the bot posts for your events — start/end
            announcements, task completions, live standings, and more. These layouts apply to
            every event your group runs; individual events can override them from their Discord
            settings. Tokens like{" "}
            <code className="text-osrs-gold-bright">{"{team_name}"}</code> are filled in when
            each message is sent.
          </>
        ) : (
          <>
            Customize the Discord embeds the bot posts for your group&apos;s notifications —
            drops, collection log slots, personal bests, and more. Placeholders like{" "}
            <code className="text-osrs-gold-bright">{"{player_name}"}</code> are filled in when
            each notification is sent.
          </>
        )}
      </p>
      <FeatureGate
        entitlement="custom_embeds"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
      >
        {eventsTab ? (
          eventLayouts && layoutMeta ? (
            <EventLayoutEditor
              scope={{ kind: "group", groupId }}
              entries={eventLayouts.layouts.map((l) => ({
                message_type: l.message_type,
                saved: l.custom,
                base: l.default,
              }))}
              meta={layoutMeta}
            />
          ) : (
            <p className="text-osrs-parchment-dark/70 text-sm">
              Event message layouts are unavailable right now — try again shortly.
            </p>
          )
        ) : embeds ? (
          <EmbedEditor groupId={groupId} initial={embeds} />
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Embed templates are unavailable right now — try again shortly.
          </p>
        )}
      </FeatureGate>
    </div>
  );
}
