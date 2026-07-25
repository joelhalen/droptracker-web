/**
 * Shared shaping for the /test-hero live panel.
 *
 * Deliberately NOT a "use client" module: the page seeds the panel on the
 * server from `api.recentFeed()` and the client re-uses the exact same
 * normaliser for SSE frames, so both paths must be importable from both
 * environments.
 */

/** One row of the live activity panel: <b>who</b> verb <em>what</em>. */
export interface FeedRow {
  key: string;
  who: string;
  verb: string;
  what: string;
  detail: string | null;
  iconUrl: string | null;
  value: number | null;
  /** True for rows that arrived over SSE — they get the arrival flash. */
  fresh: boolean;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Normalise one realtime envelope (`services/realtime.py` publishes `type` +
 * display-ready `data`) into a display row. Unknown types and malformed
 * payloads return null so callers can just filter.
 */
export function toRow(
  type: string,
  data: Record<string, unknown>,
  key: string,
  fresh: boolean,
): FeedRow | null {
  const who = str(data.player_name) ?? "Someone";
  const icon = str(data.icon_url);

  switch (type) {
    case "drop": {
      const value = num(data.value);
      if (!value || value <= 0) return null;
      return {
        key,
        who,
        verb: "received",
        what: str(data.item_name) ?? "an item",
        detail: str(data.npc_name),
        iconUrl: icon,
        value,
        fresh,
      };
    }
    case "pet":
      return {
        key,
        who,
        verb: "got a pet",
        what: str(data.pet_name) ?? "a pet",
        detail: str(data.npc_name),
        iconUrl: icon,
        value: null,
        fresh,
      };
    case "personal_best": {
      const npc = str(data.npc_name);
      const time = str(data.time_display);
      if (!npc || !time) return null;
      const teamSize = str(data.team_size);
      return {
        key,
        who,
        verb: "set a personal best",
        what: time,
        detail: teamSize ? `${npc} · ${teamSize}` : npc,
        iconUrl: str(data.npc_icon_url),
        value: null,
        fresh,
      };
    }
    case "group_created": {
      const name = str(data.group_name);
      if (!name) return null;
      return {
        key,
        who: name,
        verb: "registered a new clan",
        what: "on DropTracker",
        detail: null,
        iconUrl: null,
        value: null,
        fresh,
      };
    }
    case "new_player": {
      const name = str(data.player_name);
      if (!name) return null;
      const n = num(data.player_number);
      return {
        key,
        who: name,
        verb: "started tracking",
        what: n ? `player #${n.toLocaleString()}` : "a new account",
        detail: null,
        iconUrl: null,
        value: null,
        fresh,
      };
    }
    default:
      return null;
  }
}
