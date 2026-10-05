/**
 * The live feed's typed entries: the `feed` realtime scope's frames and the
 * `/feed/recent` history (backend `services/realtime.py`), parsed once.
 *
 * Shared by the site's header ticker (`components/live-drop-ticker.tsx`) and
 * the Discord Activity's home feed (`lib/activity/feed.ts`), so one frame has
 * one meaning on both. Before this the Activity carried a trimmed copy that
 * dropped `group_created` and `subscription` and gated PBs and drops
 * differently (tracker #16 t140).
 *
 * Pure (no React), unit-tested in `test/feed-entries.test.ts`.
 */

export type FeedDrop = {
  kind: "drop";
  key: string;
  playerId: number | null;
  playerName: string;
  itemId: number | null;
  itemName: string | null;
  npcId: number | null;
  npcName: string | null;
  iconUrl: string | null;
  npcIconUrl: string | null;
  value: number;
};

export type FeedPersonalBest = {
  kind: "personal_best";
  key: string;
  playerId: number | null;
  playerName: string;
  npcId: number | null;
  npcName: string;
  npcIconUrl: string | null;
  timeDisplay: string;
  teamSize: string | null;
  rank: number;
};

export type FeedPet = {
  kind: "pet";
  key: string;
  playerId: number | null;
  playerName: string;
  petName: string;
  itemId: number | null;
  iconUrl: string | null;
};

export type FeedGroupCreated = {
  kind: "group_created";
  key: string;
  groupId: number;
  groupName: string;
};

export type FeedNewPlayer = {
  kind: "new_player";
  key: string;
  playerId: number | null;
  playerName: string;
  playerNumber: number | null;
};

export type FeedSubscription = {
  kind: "subscription";
  key: string;
  scope: "group" | "user";
  name: string;
  groupId: number | null;
  playerId: number | null;
};

export type FeedEntry =
  | FeedDrop
  | FeedPersonalBest
  | FeedPet
  | FeedGroupCreated
  | FeedNewPlayer
  | FeedSubscription;

export function parseFeedEntityId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveNpcId(data: Record<string, unknown>): number | null {
  const fromField = parseFeedEntityId(data.npc_id);
  if (fromField !== null) return fromField;
  const iconUrl = asString(data.npc_icon_url);
  if (!iconUrl) return null;
  const match = /\/npcdb\/(\d+)/.exec(iconUrl);
  return match ? parseFeedEntityId(match[1]) : null;
}

/** Parse one realtime envelope (`type` + display-ready `data`) into a typed
 *  ticker entry; unknown types and malformed payloads return null. */
export function toFeedEntry(
  type: string,
  data: Record<string, unknown>,
  key: string,
): FeedEntry | null {
  switch (type) {
    case "drop": {
      const value = Number(data.value ?? 0);
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        kind: "drop",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        itemId: parseFeedEntityId(data.item_id),
        itemName: asString(data.item_name),
        npcId: resolveNpcId(data),
        npcName: asString(data.npc_name),
        iconUrl: asString(data.icon_url),
        npcIconUrl: asString(data.npc_icon_url),
        value,
      };
    }
    case "personal_best": {
      const rank = parseFeedEntityId(data.rank);
      const npcName = asString(data.npc_name);
      const timeDisplay = asString(data.time_display);
      if (!rank || !npcName || !timeDisplay) return null;
      return {
        kind: "personal_best",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        npcId: resolveNpcId(data),
        npcName,
        npcIconUrl: asString(data.npc_icon_url),
        timeDisplay,
        teamSize: asString(data.team_size),
        rank,
      };
    }
    case "pet": {
      const petName = asString(data.pet_name);
      if (!petName) return null;
      return {
        kind: "pet",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName: asString(data.player_name) ?? "Someone",
        petName,
        itemId: parseFeedEntityId(data.item_id),
        iconUrl: asString(data.icon_url),
      };
    }
    case "group_created": {
      const groupId = parseFeedEntityId(data.group_id);
      const groupName = asString(data.group_name);
      if (!groupId || !groupName) return null;
      return { kind: "group_created", key, groupId, groupName };
    }
    case "new_player": {
      const playerName = asString(data.player_name);
      if (!playerName) return null;
      return {
        kind: "new_player",
        key,
        playerId: parseFeedEntityId(data.player_id),
        playerName,
        playerNumber: parseFeedEntityId(data.player_number),
      };
    }
    case "subscription": {
      const name = asString(data.name);
      if (!name) return null;
      return {
        kind: "subscription",
        key,
        scope: data.kind === "group" ? "group" : "user",
        name,
        groupId: parseFeedEntityId(data.group_id),
        playerId: parseFeedEntityId(data.player_id),
      };
    }
    default:
      return null;
  }
}
