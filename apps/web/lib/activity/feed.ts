"use client";

/**
 * Minimal live-feed parser for the Activity home screen — turns the untyped
 * `data` records of /feed/recent history entries and rt:feed SSE frames into
 * rows the UI can render. A trimmed sibling of live-drop-ticker's toFeedEntry
 * (icons arrive pre-rewritten to /img by the activity BFF).
 */
export type ActivityFeedRow = {
  key: string;
  kind: "drop" | "pb" | "pet" | "new_player";
  playerId: number | null;
  playerName: string;
  headline: string;
  detail: string;
  iconUrl: string | null;
  /** GP for drops; null otherwise. */
  value: number | null;
};

const asStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const asId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export function toActivityFeedRow(
  type: string,
  data: Record<string, unknown>,
  key: string,
): ActivityFeedRow | null {
  const playerId = asId(data.player_id);
  const playerName = asStr(data.player_name) ?? "Someone";
  switch (type) {
    case "drop": {
      const value = Number(data.value ?? 0);
      const itemName = asStr(data.item_name);
      if (!Number.isFinite(value) || value <= 0 || !itemName) return null;
      return {
        key,
        kind: "drop",
        playerId,
        playerName,
        headline: itemName,
        detail: asStr(data.npc_name) ? `from ${asStr(data.npc_name)}` : "drop",
        iconUrl: asStr(data.icon_url),
        value,
      };
    }
    case "personal_best": {
      const npcName = asStr(data.npc_name);
      const time = asStr(data.time_display);
      if (!npcName || !time) return null;
      return {
        key,
        kind: "pb",
        playerId,
        playerName,
        headline: `${time} at ${npcName}`,
        detail: asStr(data.team_size) ? `personal best · ${asStr(data.team_size)}` : "personal best",
        iconUrl: asStr(data.npc_icon_url),
        value: null,
      };
    }
    case "pet": {
      const petName = asStr(data.pet_name);
      if (!petName) return null;
      return {
        key,
        kind: "pet",
        playerId,
        playerName,
        headline: petName,
        detail: "new pet",
        iconUrl: asStr(data.icon_url),
        value: null,
      };
    }
    case "new_player": {
      return {
        key,
        kind: "new_player",
        playerId,
        playerName,
        headline: "joined DropTracker",
        detail: "new tracker",
        iconUrl: null,
        value: null,
      };
    }
    default:
      return null;
  }
}
