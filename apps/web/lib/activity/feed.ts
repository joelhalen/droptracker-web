/**
 * The Activity home screen's live-feed rows: a display projection of the
 * site ticker's own parse (`lib/feed-entries.ts`), so a frame shows (or not)
 * on both surfaces by the same rules and every type the ticker handles,
 * including new clans and supporters, reaches the Activity too.
 *
 * Live SSE frames carry absolute www icon URLs (only the history read goes
 * through the BFF's rewrite), so icons are mapped to iframe-safe addresses
 * here.
 */
import { toFeedEntry, type FeedEntry } from "@/lib/feed-entries";
import { activityImgUrl } from "@/lib/activity/img-proxy";

export type ActivityFeedRow = {
  key: string;
  kind: FeedEntry["kind"];
  /** The player the row is about, when there is one. */
  playerId: number | null;
  /** The clan the row is about (a new clan, a clan's subscription). */
  groupId: number | null;
  /** Who the row is about: a player's or a clan's name. */
  subject: string;
  headline: string;
  detail: string;
  iconUrl: string | null;
  /** GP for drops; null otherwise. */
  value: number | null;
};

const img = (url: string | null): string | null => activityImgUrl(url) ?? null;

export function feedRowFromEntry(e: FeedEntry): ActivityFeedRow {
  const base = { key: e.key, kind: e.kind, value: null, groupId: null } as const;
  switch (e.kind) {
    case "drop":
      return {
        ...base,
        playerId: e.playerId,
        subject: e.playerName,
        headline: e.itemName ?? "a valuable drop",
        detail: e.npcName ? `from ${e.npcName}` : "drop",
        iconUrl: img(e.iconUrl ?? e.npcIconUrl),
        value: e.value,
      };
    case "personal_best":
      return {
        ...base,
        playerId: e.playerId,
        subject: e.playerName,
        headline: `${e.timeDisplay} at ${e.npcName}`,
        detail: [`#${e.rank} personal best`, e.teamSize].filter(Boolean).join(" · "),
        iconUrl: img(e.npcIconUrl),
      };
    case "pet":
      return {
        ...base,
        playerId: e.playerId,
        subject: e.playerName,
        headline: e.petName,
        detail: "new pet",
        iconUrl: img(e.iconUrl),
      };
    case "new_player":
      return {
        ...base,
        playerId: e.playerId,
        subject: e.playerName,
        headline: "joined DropTracker",
        detail: e.playerNumber ? `tracker #${e.playerNumber.toLocaleString("en-US")}` : "new tracker",
        iconUrl: null,
      };
    case "group_created":
      return {
        ...base,
        playerId: null,
        groupId: e.groupId,
        subject: e.groupName,
        headline: "started tracking",
        detail: "new clan",
        iconUrl: null,
      };
    case "subscription":
      return {
        ...base,
        playerId: e.scope === "user" ? e.playerId : null,
        groupId: e.scope === "group" ? e.groupId : null,
        subject: e.name,
        headline: "became a supporter",
        detail: e.scope === "group" ? "clan supporter" : "supporter",
        iconUrl: null,
      };
  }
}

export function toActivityFeedRow(
  type: string,
  data: Record<string, unknown>,
  key: string,
): ActivityFeedRow | null {
  const entry = toFeedEntry(type, data, key);
  return entry ? feedRowFromEntry(entry) : null;
}
