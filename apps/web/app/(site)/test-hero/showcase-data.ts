/**
 * Curated media manifest for the /test-hero homepage prototype.
 *
 * Every entry is a REAL submission mined from the production `drops` table
 * (value * quantity >= 1M, carrying a stored `image_url`) or a real generated
 * DropTracker asset. Nothing here is stock art or AI-generated — the rule for
 * this page is that every pixel is either Old School RuneScape or DropTracker.
 *
 * Curation (rather than a live query) is deliberate: a homepage wants the
 * *best* proof, not the newest, and there is no public API surface for
 * "high-value drops that happen to carry a screenshot". Live, always-current
 * data — leaderboards, monthly totals, the drop feed, supporters, the bingo
 * board — is fetched at render time in page.tsx instead.
 *
 * No video: replay-buffer capture is out of the plugin pending core RuneLite
 * client changes, so this page shows and references screenshots only.
 */

export const IMG_BASE = "https://www.droptracker.io/img";

export const itemIcon = (id: number) => `${IMG_BASE}/itemdb/${id}.png`;
export const npcIcon = (id: number) => `${IMG_BASE}/npcdb/${id}.png`;

/** One real drop, with the screenshot the plugin attached to it. */
export interface ShowcaseDrop {
  dropId: number;
  itemId: number;
  itemName: string;
  npcId: number;
  npcName: string;
  playerId: number;
  playerName: string;
  /** GP value at the time of the drop (value * quantity). */
  value: number;
  /** Unix seconds — `date_added` on the drop row. */
  ts: number;
  /** The in-game screenshot submitted with the drop. */
  src: string;
  /** Intrinsic pixel size, so tiles reserve the right box before it loads. */
  width: number;
  height: number;
}

/**
 * Notable drops — the exact JPEGs the plugin attached to the submission and the
 * bot posts to Discord (chat box, drop text, kill timer and all). Both the
 * gallery and the hero dial read from this list.
 *
 * ONE ENTRY PER ITEM, deliberately: the dial arranges these around a ring, and
 * two Twisted bows in the same ring reads as a bug. `uniqueByItem` below is the
 * runtime guard.
 */
export const DROP_SHOTS: ShowcaseDrop[] = [
  {
    dropId: 172849757,
    itemId: 20997,
    itemName: "Twisted bow",
    npcId: 13696,
    npcName: "Chambers of Xeric",
    playerId: 3823,
    playerName: "TumekensKush",
    value: 1_489_000_000,
    ts: 1784651411,
    src: `${IMG_BASE}/user-upload/1683393/drop/Chambers_of_Xeric/Twisted_bow_0.jpg`,
    width: 1233,
    height: 793,
  },
  {
    dropId: 167714814,
    itemId: 22486,
    itemName: "Scythe of vitur (uncharged)",
    npcId: 13961,
    npcName: "Theatre of Blood: Hard Mode",
    playerId: 738,
    playerName: "Redquaker",
    value: 1_313_695_104,
    ts: 1783754100,
    src: `${IMG_BASE}/user-upload/32216/drop/Theatre_of_Blood__Hard_Mode/Theatre_of_Blood__Hard_Mode_Scythe_of_vitur_(uncharged).jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 173904420,
    itemId: 27277,
    itemName: "Tumeken's shadow (uncharged)",
    npcId: 13695,
    npcName: "Tombs of Amascut",
    playerId: 6450,
    playerName: "Bun nG",
    value: 810_000_000,
    ts: 1784821752,
    src: `${IMG_BASE}/user-upload/875243/drop/Tombs_of_Amascut/Tombs_of_Amascut_Tumeken's_shadow_(uncharged).jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 174012554,
    itemId: 24511,
    itemName: "Harmonised orb",
    npcId: 9416,
    npcName: "Phosani's Nightmare",
    playerId: 1667373,
    playerName: "HazelCult",
    value: 406_260_000,
    ts: 1784837083,
    src: `${IMG_BASE}/user-upload/1889707/drop/Phosani's_Nightmare/Phosani's_Nightmare_Harmonised_orb.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 174311276,
    itemId: 24417,
    itemName: "Inquisitor's mace",
    npcId: 9416,
    npcName: "Phosani's Nightmare",
    playerId: 5751918,
    playerName: "kerzington",
    value: 352_789_765,
    ts: 1784882358,
    src: `${IMG_BASE}/user-upload/1941874/drop/Phosani's_Nightmare/Phosani's_Nightmare_Inquisitor's_mace_1.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 174544369,
    itemId: 26372,
    itemName: "Nihil horn",
    npcId: 11278,
    npcName: "Nex",
    playerId: 7199,
    playerName: "Sussy Steve",
    value: 336_291_968,
    ts: 1784919515,
    src: `${IMG_BASE}/user-upload/1881858/drop/Nex/Nihil_horn_0.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 170562459,
    itemId: 12437,
    itemName: "3rd age cloak",
    npcId: 13955,
    npcName: "Clue Scroll (Master)",
    playerId: 7276,
    playerName: "Appealx",
    value: 306_777_777,
    ts: 1784311749,
    src: `${IMG_BASE}/user-upload/364019/drop/Clue_Scroll_(Master)/Clue_Scroll_(Master)_3rd_age_cloak.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 171780763,
    itemId: 26376,
    itemName: "Torva full helm (damaged)",
    npcId: 11278,
    npcName: "Nex",
    playerId: 5752950,
    playerName: "Arkveld",
    value: 209_300_000,
    ts: 1784487675,
    src: `${IMG_BASE}/user-upload/146496/drop/Nex/Nex_Torva_full_helm_(damaged).jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 172114898,
    itemId: 31088,
    itemName: "Avernic treads",
    npcId: 14707,
    npcName: "Doom of Mokhaiotl",
    playerId: 5754339,
    playerName: "roobs",
    value: 180_000_000,
    ts: 1784536877,
    src: `${IMG_BASE}/user-upload/938545/drop/Doom_of_Mokhaiotl/Doom_of_Mokhaiotl_Avernic_treads_2.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 173014290,
    itemId: 24517,
    itemName: "Eldritch orb",
    npcId: 9416,
    npcName: "Phosani's Nightmare",
    playerId: 5753325,
    playerName: "H0lybagel",
    value: 153_474_134,
    ts: 1784672049,
    src: `${IMG_BASE}/user-upload/267543/drop/Phosani's_Nightmare/Phosani's_Nightmare_Eldritch_orb.jpg`,
    width: 1920,
    height: 1080,
  },
];

/**
 * The dial must never show the same item twice, so a Twisted bow can't sit
 * opposite another Twisted bow. The list above is already one entry per item;
 * this is the guard that keeps it that way if someone adds to it later.
 */
export function uniqueByItem(drops: ShowcaseDrop[]): ShowcaseDrop[] {
  const seen = new Set<number>();
  return drops.filter((d) => (seen.has(d.itemId) ? false : (seen.add(d.itemId), true)));
}

/**
 * Real generated DropTracker artwork.
 *
 * Deliberately does NOT include the old server-rendered bingo PNGs: boards are
 * composed in React from `task.tile` icon data now (components/bingo-tile.tsx),
 * so the events section renders a live board instead of shipping stale art.
 */
export const ARTWORK = {
  /** Pegasus PvM's live monthly lootboard (Pillow-rendered, OSRS UI font). */
  lootboardLive: `${IMG_BASE}/clans/14/lb/lootboard.png`,
  /** A second live board, so the section can cross-fade between real clans. */
  lootboardAlt: `${IMG_BASE}/clans/7/lb/lootboard.png`,
  /** Realists' September board — the classic layout with the loot chest art. */
  lootboardClassic: `${IMG_BASE}/example-board.png`,
  /** The Discord embed the notification service posts for a qualifying drop. */
  discordEmbed: `${IMG_BASE}/drop_embed.png`,
  /** The DropTracker panel inside RuneLite. */
  plugin: `${IMG_BASE}/plugin-image.png`,
} as const;

/**
 * The DropTracker global group. Every tracked account belongs to it, so its
 * profile (`GET /groups/2`) is the honest source for "total loot tracked this
 * month" and "accounts tracked" — both live, and no aggregate query needed.
 */
export const GLOBAL_GROUP_ID = 2;

/**
 * Submissions processed in July 2026, measured directly against the production
 * `data` schema. A snapshot rather than a per-request aggregate: a COUNT over
 * the full `drops` table exceeds the query timeout budget for a page render.
 *
 * Re-measure with:
 *   SELECT COUNT(*) FROM drops WHERE date_added >= '2026-07-01';
 */
export const MEASURED = {
  asOf: "2026-07-25",
  submissionsThisMonth: 11_596_210,
} as const;
