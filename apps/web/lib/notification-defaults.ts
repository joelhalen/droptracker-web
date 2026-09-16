/**
 * The staff Default embeds page (`/admin/embeds`): pure shaping between the
 * Web API's defaults payloads and the group editors that page reuses, plus the
 * one sentence each type shows about who an edit reaches.
 *
 * The editors were written for a group's own designs — "custom" plus the
 * "default" it falls back to. Over the site-wide defaults the same two slots
 * hold the stored default and the built-in behind it, which is why the
 * mapping is a rename and nothing more.
 */
import type {
  EmbedDefaultsResponse,
  EmbedType,
  EventLayoutDefaultsResponse,
  EventMessageLayout,
  GroupEmbedsResponse,
  NotificationLayoutDefaultsResponse,
  NotificationLayoutEntry,
} from "@droptracker/api-types";

/** How many groups keep their own design of one type, and how many of those
 * are actually sent it (their plan includes custom designs). */
export type DefaultUsage = { custom: number; overriding: number };

/** For starting layouts: groups with a saved layout, and those sending one. */
export type StartingPointUsage = { custom: number; live: number };

export function embedEditorEntries(resp: EmbedDefaultsResponse): GroupEmbedsResponse {
  return {
    embeds: resp.embeds.map((e) => ({
      embed_type: e.embed_type,
      custom: e.template,
      default: e.builtin,
    })),
  };
}

export function embedUsage(resp: EmbedDefaultsResponse): Partial<Record<EmbedType, DefaultUsage>> {
  return Object.fromEntries(
    resp.embeds.map((e) => [e.embed_type, { custom: e.custom_count, overriding: e.override_count }]),
  );
}

/** Structurally the event editor's `LayoutEntry`. */
export function eventLayoutEditorEntries(
  resp: EventLayoutDefaultsResponse,
): { message_type: string; saved: EventMessageLayout | null; base: EventMessageLayout }[] {
  return resp.layouts.map((l) => ({
    message_type: l.message_type,
    saved: l.template,
    base: l.builtin,
  }));
}

export function eventLayoutUsage(resp: EventLayoutDefaultsResponse): Record<string, DefaultUsage> {
  return Object.fromEntries(
    resp.layouts.map((l) => [l.message_type, { custom: l.custom_count, overriding: l.override_count }]),
  );
}

/** A starting layout is never live: group 1 sends nothing. */
export function notificationLayoutEditorEntries(
  resp: NotificationLayoutDefaultsResponse,
): NotificationLayoutEntry[] {
  return resp.layouts.map((l) => ({
    notification_type: l.notification_type,
    custom: l.template,
    active: false,
    default: l.builtin,
    updated_at: null,
  }));
}

export function notificationLayoutUsage(
  resp: NotificationLayoutDefaultsResponse,
): Record<string, StartingPointUsage> {
  return Object.fromEntries(
    resp.layouts.map((l) => [l.notification_type, { custom: l.custom_count, live: l.live_count }]),
  );
}

function groups(n: number): string {
  return n === 1 ? "1 group" : `${n.toLocaleString("en-US")} groups`;
}

/**
 * Who an edit to a sent default reaches. `noun` names the design, e.g.
 * "drops template". A group that saved its own but has no plan that sends it
 * still gets the default, so only `overriding` is subtracted.
 */
export function defaultReach(noun: string, usage: DefaultUsage | undefined): string {
  const custom = usage?.custom ?? 0;
  const overriding = Math.min(usage?.overriding ?? 0, custom);
  if (overriding === 0) {
    return custom === 0
      ? `Every group is sent this default — none has its own ${noun}.`
      : `Every group is sent this default. ${groups(custom)} saved their own ${noun}, but none is on a plan that sends it.`;
  }
  const head =
    `Sent to every group except the ${groups(overriding)} that ` +
    `${overriding === 1 ? "sends its" : "send their"} own ${noun}.`;
  const rest = custom - overriding;
  if (rest === 0) return head;
  return (
    `${head} ${rest === 1 ? "1 more group" : `${rest.toLocaleString("en-US")} more groups`} ` +
    `saved one without a plan that sends it, so ${rest === 1 ? "it gets" : "they get"} this default.`
  );
}

/** Who an edit to a starting layout reaches: groups that have not designed
 * their own yet, the next time they do. */
export function startingPointReach(usage: StartingPointUsage | undefined): string {
  const custom = usage?.custom ?? 0;
  const live = Math.min(usage?.live ?? 0, custom);
  const head = "Groups start from this layout when they design this notification as components.";
  if (custom === 0) return `${head} No group has saved its own yet.`;
  const sending = live === 0 ? "" : ` (${live.toLocaleString("en-US")} sending it now)`;
  return `${head} ${groups(custom)} already saved their own, which this doesn't change${sending}.`;
}
