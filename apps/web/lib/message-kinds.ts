/**
 * The four kinds of custom notification message: death, collection log, drop
 * and personal best (backend `db/member_messages.py` `MESSAGE_KINDS`).
 *
 * Each kind has the same three group settings (`<kind>_message_variants`,
 * `<kind>_message_as_embed_description`, `allow_member_<kind>_messages`) and
 * the same editors; this is what differs between them: the placeholders a
 * group's own lines can use, the starter lines, and the example notification
 * the list editor previews a line in.
 */
import type { MemberMessageType } from "@droptracker/api-types";
import {
  DEATH_CONTENT_SAMPLE_OVERRIDES,
  DEATH_PLACEHOLDERS,
  SUGGESTED_DEATH_MESSAGES,
  type PlaceholderDoc,
} from "@/lib/death-placeholders";

export interface MessageKindProfile {
  type: MemberMessageType;
  /** "drop", "collection log": how a sentence names it. */
  noun: string;
  /** Placeholders a group's own lines can use (the editor's chips + preview). */
  placeholders: PlaceholderDoc[];
  /** Sample overrides for the message-text placement (no markdown links there). */
  contentOverrides: Record<string, string>;
  suggested: string[];
  /** The row's placeholder text. */
  example: string;
  preview: {
    title: string;
    color: string;
    /** The embed description when the line is sent as the message text. */
    description: string;
    /** The message text when the line goes inside the embed. */
    content: string;
    fields: [string, string][];
  };
}

const PLAYER = {
  token: "{player_name}",
  help: "The player (links to their profile in an embed)",
  sample: "[RuneLite Ron](https://www.droptracker.io/players/1)",
};
const PLAYER_PLAIN = {
  token: "{player_name_plain}",
  help: "The player, with no profile link",
  sample: "RuneLite Ron",
};
const CONTENT_OVERRIDES = { "{player_name}": "RuneLite Ron", "{video_link}": "" };

export const MESSAGE_KINDS: Record<MemberMessageType, MessageKindProfile> = {
  death: {
    type: "death",
    noun: "death",
    placeholders: DEATH_PLACEHOLDERS,
    contentOverrides: DEATH_CONTENT_SAMPLE_OVERRIDES,
    suggested: SUGGESTED_DEATH_MESSAGES,
    example: "{player_name} has died to {source}.",
    preview: {
      title: "Player Death",
      color: "#B23B3B",
      description: "[RuneLite Ron](https://www.droptracker.io/players/1) has died.",
      content: "RuneLite Ron has died!",
      fields: [
        ["Killed By", "Abyssal demon"],
        ["Location", "Catacombs of Kourend"],
      ],
    },
  },
  drop: {
    type: "drop",
    noun: "drop",
    placeholders: [
      PLAYER,
      PLAYER_PLAIN,
      { token: "{item_name}", help: "The item", sample: "Twisted bow" },
      { token: "{source}", help: "What dropped it", sample: "Great Olm" },
      { token: "{npc_name}", help: "Same as {source}", sample: "Great Olm" },
      { token: "{value}", help: "What it's worth", sample: "1.2B" },
      { token: "{item_value}", help: "What it's worth, as the embed shows it", sample: "`1.2B`" },
      { token: "{quantity}", help: "How many", sample: "1" },
      { token: "{kill_count}", help: "The player's kill count there", sample: "57" },
    ],
    contentOverrides: CONTENT_OVERRIDES,
    suggested: [
      "{player_name} just pulled a {item_name} from {source}!",
      "Big money: {player_name} got a {item_name} ({value}).",
      "{source} coughed up a {item_name} for {player_name}.",
      "{player_name} is {value} richer thanks to {source}.",
    ],
    example: "{player_name} just pulled a {item_name} from {source}!",
    preview: {
      title: "Twisted bow",
      color: "#D4A017",
      description:
        "[RuneLite Ron](https://www.droptracker.io/players/1) received a drop from **Great Olm**.",
      content: "RuneLite Ron received a drop:",
      fields: [
        ["Value", "1.2B"],
        ["Kill count", "57"],
      ],
    },
  },
  clog: {
    type: "clog",
    noun: "collection log",
    placeholders: [
      PLAYER,
      PLAYER_PLAIN,
      { token: "{item_name}", help: "The item logged", sample: "Tanzanite fang" },
      { token: "{source}", help: "Where it came from", sample: "Zulrah" },
      { token: "{npc_name}", help: "Same as {source}", sample: "Zulrah" },
      { token: "{collection_name}", help: "The collection log page", sample: "Zulrah" },
      { token: "{kill_count}", help: "The player's kill count there", sample: "412" },
      { token: "{slots_unlocked}", help: "The player's collection log slots", sample: "1,024" },
      { token: "{slots_total}", help: "Collection log slots in the game", sample: "1,692" },
    ],
    contentOverrides: CONTENT_OVERRIDES,
    suggested: [
      "{player_name} added {item_name} to their collection log!",
      "New log slot for {player_name}: {item_name} from {source}.",
      "{player_name} is now on {slots_unlocked}/{slots_total} log slots.",
      "{item_name} finally showed up for {player_name} after {kill_count} kills.",
    ],
    example: "{player_name} added {item_name} to their collection log!",
    preview: {
      title: "Collection log",
      color: "#7F5AF0",
      description: "New slot: **Tanzanite fang**",
      content: "RuneLite Ron has added an item to their collection log!",
      fields: [
        ["Source", "Zulrah"],
        ["Slots", "1,024/1,692"],
      ],
    },
  },
  pb: {
    type: "pb",
    noun: "personal best",
    placeholders: [
      PLAYER,
      PLAYER_PLAIN,
      { token: "{boss}", help: "The boss or activity", sample: "Vorkath" },
      { token: "{npc_name}", help: "Same as {boss}", sample: "Vorkath" },
      { token: "{time}", help: "The new best time", sample: "1:02.40" },
      { token: "{personal_best}", help: "Same as {time}", sample: "1:02.40" },
      { token: "{team_size}", help: "Team size", sample: "Solo" },
      { token: "{kill_count}", help: "The player's kill count there", sample: "1,204" },
    ],
    contentOverrides: CONTENT_OVERRIDES,
    suggested: [
      "{player_name} set a new {boss} PB: {time}!",
      "{player_name} is getting faster: {boss} in {time}.",
      "New personal best! {player_name} cleared {boss} in {time} ({team_size}).",
      "{player_name} shaved their {boss} time down to {time}.",
    ],
    example: "{player_name} set a new {boss} PB: {time}!",
    preview: {
      title: "Personal best",
      color: "#3BA55D",
      description: "**Vorkath** in **1:02.40**",
      content: "RuneLite Ron has achieved a new personal best:",
      fields: [
        ["Team size", "Solo"],
        ["Kill count", "1,204"],
      ],
    },
  },
};

/** The kind a `<kind>_message_variants` config key belongs to (death otherwise). */
export function messageKindForKey(key: string): MemberMessageType {
  const match = /^(death|clog|drop|pb)_message_variants$/.exec(key.replace(/^seasonal_/, ""));
  return (match?.[1] as MemberMessageType | undefined) ?? "death";
}
