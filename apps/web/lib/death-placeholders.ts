/**
 * Placeholder docs for death notifications — mirrors what the notification
 * service substitutes (disc services/notification_service.py, death sender).
 *
 * Single source for the embed editor's death token list and the death
 * message-list editor's token picker + sample preview values.
 */

export type PlaceholderDoc = { token: string; help: string; sample: string };

export const DEATH_PLACEHOLDERS: PlaceholderDoc[] = [
  { token: "{player_name}", help: "Player who died (links to their profile)", sample: "[RuneLite Ron](https://www.droptracker.io/players/1)" },
  { token: "{player_name_plain}", help: "Player who died, with no profile link", sample: "RuneLite Ron" },
  { token: "{source}", help: "What killed the player", sample: "Abyssal demon" },
  { token: "{killer}", help: "Alias for {source}", sample: "Abyssal demon" },
  { token: "{location}", help: "Where the death occurred", sample: "Catacombs of Kourend" },
  { token: "{region_id}", help: "OSRS region id", sample: "6551" },
  { token: "{timestamp}", help: "When the death occurred", sample: "today" },
  { token: "{plugin_version}", help: "RuneLite plugin version that submitted the event (empty if unknown)", sample: "5.4.0" },
  { token: "{image_url}", help: "Screenshot URL (when submitted)", sample: "" },
  { token: "{video_url}", help: "Video URL (when submitted)", sample: "" },
  { token: "{video_link}", help: "Markdown link to the video", sample: "" },
];

/**
 * As the message content line the backend swaps the link-form tokens for
 * plain values (message content renders no markdown links), so the preview
 * must do the same.
 */
export const DEATH_CONTENT_SAMPLE_OVERRIDES: Record<string, string> = {
  "{player_name}": "RuneLite Ron",
  "{video_link}": "",
};

/**
 * Starter messages the editor can insert (client-side only — nothing is
 * seeded in the DB). Written in the spirit of the in-game clan broadcast
 * death lines.
 */
export const SUGGESTED_DEATH_MESSAGES: string[] = [
  "{player_name} has died to {source}.",
  "{player_name} has been defeated by {source} in {location}.",
  "Oh dear, {player_name} is dead. Blame {source}.",
  "{player_name} just paid {source} a visit to Death's office.",
  "{source} has claimed another victim: {player_name}.",
  "{player_name} forgot to pray against {source}.",
  "{player_name} died as they lived: somewhere near {location}.",
  "Press F — {player_name} was slain by {source}.",
];
