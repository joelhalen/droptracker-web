import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import {
  embedEditorEntries,
  embedUsage,
  eventLayoutEditorEntries,
  eventLayoutUsage,
  notificationLayoutEditorEntries,
  notificationLayoutUsage,
} from "@/lib/notification-defaults";
import { Alert } from "@/components/ui";
import { EmbedEditor } from "@/components/embed-editor";
import { EventLayoutEditor } from "@/components/event-layout-editor";
import { NotificationLayoutEditor } from "@/components/notification-layout-editor";

export const metadata: Metadata = { title: "Default embeds" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string }>;

type Loaded<T> = { data: T; error: null } | { data: null; error: string };

async function load<T>(fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await fetcher(), error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err, "Failed to load the defaults.") };
  }
}

const SKIPPED = { data: null, error: null } as const;

/**
 * Staff editor over the site-wide notification designs — what every group
 * without its own is sent. The same three editors a group gets on its own
 * Embeds page, in their `defaults` scope; the tabs mirror that page.
 */
export default async function AdminDefaultEmbedsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSuperadmin("/admin/embeds");
  const { tab } = await searchParams;
  const eventsTab = tab === "events";
  const componentsTab = tab === "components";
  const embedsTab = !eventsTab && !componentsTab;

  const [embeds, eventLayouts, eventMeta, componentLayouts, componentMeta] = await Promise.all([
    embedsTab ? load(() => api.embedDefaults()) : SKIPPED,
    eventsTab ? load(() => api.eventLayoutDefaults()) : SKIPPED,
    eventsTab ? load(() => api.eventLayoutMeta()) : SKIPPED,
    componentsTab ? load(() => api.notificationLayoutDefaults()) : SKIPPED,
    componentsTab ? load(() => api.notificationLayoutMeta()) : SKIPPED,
  ]);
  const error =
    embeds.error ??
    eventLayouts.error ??
    eventMeta.error ??
    componentLayouts.error ??
    componentMeta.error;

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
    }`;

  return (
    <div>
      <div className="border-osrs-bronze/30 mb-4 inline-flex flex-wrap gap-1 rounded-lg border p-1">
        <Link href="/admin/embeds" className={tabClass(embedsTab)}>
          Embed templates
        </Link>
        <Link href="/admin/embeds?tab=events" className={tabClass(eventsTab)}>
          Event messages
        </Link>
        <Link href="/admin/embeds?tab=components" className={tabClass(componentsTab)}>
          Component layouts
        </Link>
      </div>

      <p className={`text-osrs-parchment-dark/70 text-sm ${componentsTab ? "mb-6" : "mb-3"}`}>
        {componentsTab ? (
          <>
            The blocks a group starts from when it switches a notification type to components on its
            own Message style tab. Starting layouts are never sent themselves, and changing one
            leaves every layout a group has already saved as it is.
          </>
        ) : eventsTab ? (
          <>
            The Discord messages the bot posts for events — start and end announcements, task
            completions, live standings and more — for every group without its own layouts, and for
            global events. Groups override these on their own Event messages tab, and single events
            from their Discord settings. Tokens like{" "}
            <code className="text-osrs-gold-bright">{"{team_name}"}</code> are filled in when each
            message is sent.
          </>
        ) : (
          <>
            The embeds the bot posts for every group that hasn&apos;t designed its own, or whose
            plan doesn&apos;t include custom notification designs. A group&apos;s own editor starts
            from these too. Placeholders like{" "}
            <code className="text-osrs-gold-bright">{"{player_name}"}</code> are filled in when each
            notification is sent.
          </>
        )}
      </p>
      {!componentsTab && (
        <Alert variant="info" className="mb-6">
          Saving here changes what most groups are sent, starting with their next{" "}
          {eventsTab ? "event message" : "notification"} — check the preview first. Every change is
          recorded in the{" "}
          <Link
            href="/admin/audit?action=notification_defaults"
            className="text-osrs-gold-bright hover:underline"
          >
            audit log
          </Link>
          .
        </Alert>
      )}

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : componentsTab ? (
        componentLayouts.data &&
        componentMeta.data && (
          <NotificationLayoutEditor
            scope={{ kind: "defaults", usage: notificationLayoutUsage(componentLayouts.data) }}
            entries={notificationLayoutEditorEntries(componentLayouts.data)}
            meta={componentMeta.data}
          />
        )
      ) : eventsTab ? (
        eventLayouts.data &&
        eventMeta.data && (
          <EventLayoutEditor
            scope={{ kind: "defaults", usage: eventLayoutUsage(eventLayouts.data) }}
            entries={eventLayoutEditorEntries(eventLayouts.data)}
            meta={eventMeta.data}
          />
        )
      ) : (
        embeds.data && (
          <EmbedEditor
            scope={{ kind: "defaults", usage: embedUsage(embeds.data) }}
            initial={embedEditorEntries(embeds.data)}
          />
        )
      )}
    </div>
  );
}
