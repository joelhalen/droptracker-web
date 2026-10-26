import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { plainTextChoice } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { EmbedEditor } from "@/components/embed-editor";
import { FooterEditor } from "@/components/footer-editor";
import { EventLayoutEditor } from "@/components/event-layout-editor";
import { NotificationLayoutEditor } from "@/components/notification-layout-editor";
import { MessageStyleExplainer } from "@/components/message-style";

export const metadata: Metadata = { title: "Discord embeds" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

// Access is gated by the (admin)/groups/[id] layout; the custom_embeds
// entitlement is gated here (and re-checked in the Server Action + Web API).
// The Footer tab is gated by custom_footer instead, which every paid plan has.
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
  const componentsTab = tab === "components";
  const footerTab = tab === "footer";
  const embedsTab = !eventsTab && !componentsTab && !footerTab;

  const [subscription, tiers, user] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);
  // The components layouts are fetched on every tab: the response reports the
  // entitlement gate, which is what decides whether the tab is offered at all.
  const [embeds, eventLayouts, layoutMeta, notificationLayouts, notificationMeta, footers, config] =
    await Promise.all([
      embedsTab ? api.groupEmbeds(groupId).catch(() => null) : null,
      eventsTab ? api.groupEventLayouts(groupId).catch(() => null) : null,
      eventsTab ? api.eventLayoutMeta().catch(() => null) : null,
      api.groupNotificationLayouts(groupId).catch(() => null),
      componentsTab ? api.notificationLayoutMeta().catch(() => null) : null,
      embedsTab || footerTab ? api.notificationFooters(groupId).catch(() => null) : null,
      // Plain-text choices (Notification style): which types send no embed.
      embedsTab ? api.groupConfig(groupId).catch(() => null) : null,
    ]);
  const plainText = plainTextChoice(config);

  const componentsEnabled = Boolean(notificationLayouts?.enabled);

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
    }`;

  return (
    <div>
      <div className="border-osrs-bronze/30 mb-4 inline-flex gap-1 rounded-lg border p-1">
        <Link href={`/groups/${groupId}/embeds`} className={tabClass(embedsTab)}>
          Embed templates
        </Link>
        <Link href={`/groups/${groupId}/embeds?tab=events`} className={tabClass(eventsTab)}>
          Event messages
        </Link>
        {componentsEnabled && (
          <Link
            href={`/groups/${groupId}/embeds?tab=components`}
            className={tabClass(componentsTab)}
          >
            Message style
          </Link>
        )}
        <Link href={`/groups/${groupId}/embeds?tab=footer`} className={tabClass(footerTab)}>
          Footer
        </Link>
      </div>

      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        {footerTab ? (
          <>
            Choose the footer under the bot&apos;s notification embeds: keep the DropTracker
            footer, remove it, or write your own. Set it once for everything, or differently for
            each type of notification.
          </>
        ) : componentsTab ? (
          <>
            Choose how each notification is sent: as the classic embed, or built out of Discord
            components you arrange yourself. Every layout here starts as a copy of your embed, so
            switching a type over changes how it&apos;s laid out, not what it says — and the same
            placeholders like{" "}
            <code className="text-osrs-gold-bright">{"{player_name}"}</code> work in both.
          </>
        ) : eventsTab ? (
          <>
            Customize the Discord messages the bot posts for your events — start/end
            announcements, task completions, live standings, and more. These layouts apply to
            every event your group runs; individual events can override them from their Discord
            settings. Tokens like{" "}
            <code className="text-osrs-gold-bright">{"{team_name}"}</code> are filled in when
            each message is sent.
          </>
        ) : (
          plainText.all ? (
          <>
            Your notifications are sent as plain text, so there are no embeds to design. Write the
            message each notification is sent with here; placeholders like{" "}
            <code className="text-osrs-gold-bright">{"{player_name}"}</code> are filled in when
            each one is sent.
          </>
          ) : (
          <>
            Customize the Discord embeds the bot posts for your group&apos;s notifications, like
            drops, collection log slots and personal bests, and the message text sent above them. Placeholders like{" "}
            <code className="text-osrs-gold-bright">{"{player_name}"}</code> are filled in when
            each notification is sent.
          </>
          )
        )}
      </p>
      {footerTab ? (
        <FeatureGate
          entitlement="custom_footer"
          subscription={subscription}
          tiers={tiers}
          groupId={groupId}
          isSuperadmin={user?.is_superadmin}
        >
          {footers ? (
            <FooterEditor groupId={groupId} initial={footers} />
          ) : (
            <p className="text-osrs-parchment-dark/70 text-sm">
              Footer settings are unavailable right now. Try again shortly.
            </p>
          )}
        </FeatureGate>
      ) : (
      <FeatureGate
        entitlement="custom_embeds"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
      >
        {componentsTab ? (
          notificationLayouts && notificationMeta && componentsEnabled ? (
            <div className="space-y-4">
              <MessageStyleExplainer />
              <NotificationLayoutEditor
                scope={{ kind: "group", groupId }}
                entries={notificationLayouts.layouts}
                meta={notificationMeta}
              />
            </div>
          ) : (
            <p className="text-osrs-parchment-dark/70 text-sm">
              Component layouts are unavailable right now — try again shortly.
            </p>
          )
        ) : eventsTab ? (
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
          <EmbedEditor
            scope={{ kind: "group", groupId }}
            initial={embeds}
            footers={footers}
            plainText={plainText}
          />
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Embed templates are unavailable right now — try again shortly.
          </p>
        )}
      </FeatureGate>
      )}
    </div>
  );
}
