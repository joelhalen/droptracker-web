/**
 * Curated media manifest for the /test-hero landing page.
 *
 * Every entry here is a REAL submission mined from the production `drops`
 * table (value * quantity >= 1M, with a stored `image_url` or `video_url`) or a
 * real generated DropTracker asset (lootboards, event boards, the Discord embed
 * screenshot). Nothing is stock art, AI-generated, or borrowed — the rule for
 * this page is that every pixel is either Old School RuneScape or DropTracker.
 *
 * Curation (rather than a live query) is deliberate: a landing page wants the
 * *best* footage, not the newest, and there is no public API surface for
 * "high-value drops that happen to carry media". Live, always-current data —
 * leaderboards, the drop feed, ranked player/clan counts — is fetched at render
 * time in page.tsx instead.
 *
 * Media hosts:
 *   https://www.droptracker.io/img/...    nginx -> the intake API's static tree
 *   https://video.droptracker.io/...      Backblaze B2 CDN (video worker output)
 */

export const IMG_BASE = "https://www.droptracker.io/img";

export const itemIcon = (id: number) => `${IMG_BASE}/itemdb/${id}.png`;
export const npcIcon = (id: number) => `${IMG_BASE}/npcdb/${id}.png`;

/** One real drop, with the proof the plugin captured alongside it. */
export interface ShowcaseDrop {
  dropId: number;
  itemId: number;
  itemName: string;
  npcId: number;
  npcName: string;
  playerName: string;
  /** GP value at the time of the drop (value * quantity). */
  value: number;
  /** Proof media — an in-game screenshot, or an MP4 clip from the replay buffer. */
  src: string;
  /** Intrinsic pixel size, so cards reserve the right box before the media loads. */
  width: number;
  height: number;
}

/**
 * Replay-buffer clips. The RuneLite plugin keeps a rolling frame buffer and
 * flushes the seconds *around* a qualifying drop; `services/video_worker.py`
 * turns the MJPEG into an H.264 MP4 on B2. Every clip below is ~10s and under
 * 3 MB, which is what makes a wall of them viable as autoplaying loops.
 */
export const DROP_CLIPS: ShowcaseDrop[] = [
  {
    dropId: 166602878,
    itemId: 12827,
    itemName: "Arcane sigil",
    npcId: 319,
    npcName: "Corporeal Beast",
    playerName: "Nycolas Cage",
    value: 119_643_933,
    src: "https://video.droptracker.io/dt_videos/4782/dfa3f0ee-5072-47c5-91fc-2725d6436b33.mp4",
    width: 926,
    height: 572,
  },
  {
    dropId: 171013129,
    itemId: 28285,
    itemName: "Ultor vestige",
    npcId: 12223,
    npcName: "Vardorvis",
    playerName: "IronPurpleJ",
    value: 112_533_952,
    src: "https://video.droptracker.io/dt_videos/5001/79af425e-5467-45fe-a49d-8362499e6066.mp4",
    width: 938,
    height: 1000,
  },
  {
    dropId: 171858693,
    itemId: 24420,
    itemName: "Inquisitor's hauberk",
    npcId: 9416,
    npcName: "Phosani's Nightmare",
    playerName: "Nycolas Cage",
    value: 112_000_000,
    src: "https://video.droptracker.io/dt_videos/4782/91d09c65-d134-4afb-99b6-801cb4a7e8f2.mp4",
    width: 946,
    height: 564,
  },
  {
    dropId: 168824534,
    itemId: 30750,
    itemName: "Oathplate helm",
    npcId: 14176,
    npcName: "Yama",
    playerName: "IronPurpleJ",
    value: 88_893_063,
    src: "https://video.droptracker.io/dt_videos/5001/7f5355be-54f6-4adb-a46e-a646089ad3b3.mp4",
    width: 944,
    height: 1002,
  },
  {
    dropId: 167781464,
    itemId: 31109,
    itemName: "Mokhaiotl cloth",
    npcId: 14707,
    npcName: "Doom of Mokhaiotl",
    playerName: "IronPurpleJ",
    value: 56_086_891,
    src: "https://video.droptracker.io/dt_videos/5001/7630a81d-21c0-4b06-b382-f33a77290885.mp4",
    width: 1920,
    height: 1010,
  },
  {
    dropId: 166974786,
    itemId: 22477,
    itemName: "Avernic defender hilt",
    npcId: 13699,
    npcName: "Theatre of Blood",
    playerName: "unknown",
    value: 34_290_150,
    src: "https://video.droptracker.io/dt_videos/3/a23ed520-7e7a-4c71-8b6a-c0e906c98161.mp4",
    width: 1674,
    height: 1080,
  },
  {
    dropId: 170964069,
    itemId: 26245,
    itemName: "Virtus robe bottom",
    npcId: 12223,
    npcName: "Vardorvis",
    playerName: "IronPurpleJ",
    value: 26_830_375,
    src: "https://video.droptracker.io/dt_videos/5001/dc0d33cb-c597-4b1c-8bdf-c5208580a520.mp4",
    width: 938,
    height: 1000,
  },
  {
    dropId: 172826409,
    itemId: 21034,
    itemName: "Dexterous prayer scroll",
    npcId: 14150,
    npcName: "Chambers of Xeric Challenge Mode",
    playerName: "Baked Buchu",
    value: 15_647_284,
    src: "https://video.droptracker.io/dt_videos/136/60995d60-e515-4d72-870c-1a08f65e4aa9.mp4",
    width: 1648,
    height: 1010,
  },
  {
    dropId: 170663561,
    itemId: 27226,
    itemName: "Masori mask",
    npcId: 13970,
    npcName: "Tombs of Amascut: Expert Mode",
    playerName: "IronPurpleJ",
    value: 10_791_647,
    src: "https://video.droptracker.io/dt_videos/5001/d2ab8f13-7f34-4992-aa40-f6765c3a2a89.mp4",
    width: 1920,
    height: 1010,
  },
];

/**
 * Screenshot proofs. These are the exact JPEGs the plugin attached to the
 * submission and the bot posts to Discord — chat box, drop text, kill timer and
 * all. Ordered biggest-first; the gallery reads top-to-bottom.
 */
export const DROP_SHOTS: ShowcaseDrop[] = [
  {
    dropId: 172849757,
    itemId: 20997,
    itemName: "Twisted bow",
    npcId: 13696,
    npcName: "Chambers of Xeric",
    playerName: "TumekensKush",
    value: 1_489_000_000,
    src: `${IMG_BASE}/user-upload/1683393/drop/Chambers_of_Xeric/Twisted_bow_0.jpg`,
    width: 1233,
    height: 793,
  },
  {
    dropId: 170830974,
    itemId: 20997,
    itemName: "Twisted bow",
    npcId: 14150,
    npcName: "Chambers of Xeric Challenge Mode",
    playerName: "Mac i",
    value: 1_491_410_010,
    src: `${IMG_BASE}/user-upload/126945/drop/Chambers_of_Xeric_Challenge_Mode/Twisted_bow_0.jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 173081734,
    itemId: 22486,
    itemName: "Scythe of vitur (uncharged)",
    npcId: 13699,
    npcName: "Theatre of Blood",
    playerName: "N e mo",
    value: 1_291_150_000,
    src: `${IMG_BASE}/user-upload/170276/drop/Theatre_of_Blood/Theatre_of_Blood_Scythe_of_vitur_(uncharged).jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 167714814,
    itemId: 22486,
    itemName: "Scythe of vitur (uncharged)",
    npcId: 13961,
    npcName: "Theatre of Blood: Hard Mode",
    playerName: "Redquaker",
    value: 1_313_695_104,
    src: `${IMG_BASE}/user-upload/32216/drop/Theatre_of_Blood__Hard_Mode/Theatre_of_Blood__Hard_Mode_Scythe_of_vitur_(uncharged).jpg`,
    width: 1920,
    height: 1080,
  },
  {
    dropId: 174528286,
    itemId: 27277,
    itemName: "Tumeken's shadow (uncharged)",
    npcId: 13970,
    npcName: "Tombs of Amascut: Expert Mode",
    playerName: "Dank Scoops",
    value: 807_250_000,
    src: `${IMG_BASE}/user-upload/562831/drop/Tombs_of_Amascut__Expert_Mode/Tombs_of_Amascut__Expert_Mode_Tumeken's_shadow_(uncharged).jpg`,
    width: 2529,
    height: 1369,
  },
  {
    dropId: 173904420,
    itemId: 27277,
    itemName: "Tumeken's shadow (uncharged)",
    npcId: 13695,
    npcName: "Tombs of Amascut",
    playerName: "Sussy Steve",
    value: 810_000_000,
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
    playerName: "HazelCult",
    value: 406_260_000,
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
    playerName: "kerzington",
    value: 352_789_765,
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
    playerName: "Sussy Steve",
    value: 336_291_968,
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
    playerName: "Appealx",
    value: 306_777_777,
    src: `${IMG_BASE}/user-upload/364019/drop/Clue_Scroll_(Master)/Clue_Scroll_(Master)_3rd_age_cloak.jpg`,
    width: 1920,
    height: 1080,
  },
];

/**
 * Real generated DropTracker artwork. The lootboards are the live PNGs the
 * `droptracker-lootboards` unit regenerates every two minutes for those clans;
 * the boards are real event renders.
 */
export const ARTWORK = {
  /** Pegasus PvM's live monthly lootboard (Pillow-rendered, OSRS UI font). */
  lootboardLive: `${IMG_BASE}/clans/14/lb/lootboard.png`,
  /** Realists' September board — the classic layout with the loot chest art. */
  lootboardClassic: `${IMG_BASE}/example-board.png`,
  /** A second live board, so the section can cross-fade between real clans. */
  lootboardAlt: `${IMG_BASE}/clans/7/lb/lootboard.png`,
  /** Rendered bingo board (5x5 of real task tiles, in-game item art). */
  bingoBoard: `${IMG_BASE}/events/3/bingo_board_all.png`,
  /** Board-game event map — the 100-tile track teams roll around. */
  boardGame: `${IMG_BASE}/events/board-default.png`,
  /** The Discord embed the notification service posts for a qualifying drop. */
  discordEmbed: `${IMG_BASE}/drop_embed.png`,
  /** In-client plugin panel. */
  plugin: `${IMG_BASE}/plugin-image.png`,
} as const;

/**
 * Item icons used for the hero constellation — chosen as the recognisable
 * "grail" items of OSRS PvM, all sourced from our own item DB mirror.
 */
export const CONSTELLATION_ITEMS = [
  20997, // Twisted bow
  22486, // Scythe of vitur
  27277, // Tumeken's shadow
  12827, // Arcane sigil
  26372, // Nihil horn
  24511, // Harmonised orb
  28285, // Ultor vestige
  30750, // Oathplate helm
  12422, // 3rd age wand
  22477, // Avernic defender hilt
  26376, // Torva full helm
  31109, // Mokhaiotl cloth
] as const;

/**
 * Loot-sweep board structure, drawn from our own NPC and item DB mirrors.
 *
 * Unlike the bingo and board-game panels — which show real rendered PNGs — no
 * loot-sweep board image exists as a static asset, so the events section builds
 * the matrix in the DOM from these ids instead. Every icon is still a real
 * `/img/npcdb` or `/img/itemdb` sprite; the claim state is illustrative and the
 * panel says so.
 */
export const LOOT_SWEEP_ROWS = [
  {
    npcId: 13696,
    npcName: "Chambers of Xeric",
    items: [20997, 21043, 21003, 13652],
  },
  {
    npcId: 13699,
    npcName: "Theatre of Blood",
    items: [22486, 22477, 22326, 22324],
  },
  {
    npcId: 13695,
    npcName: "Tombs of Amascut",
    items: [27277, 27226, 25985, 26219],
  },
  {
    npcId: 11278,
    npcName: "Nex",
    items: [26376, 26372, 26235, 26370],
  },
  {
    npcId: 9416,
    npcName: "Phosani's Nightmare",
    items: [24417, 24511, 24420, 24517],
  },
  {
    npcId: 12223,
    npcName: "Vardorvis",
    items: [28285, 26245, 28277, 28319],
  },
] as const;

/**
 * Platform totals measured directly against the production `data` schema. These
 * move slowly (they are lifetime counts, not live gauges), so they are snapshot
 * values rather than a per-request aggregate — a `SUM`/`COUNT` over the full
 * `drops` table exceeds the query timeout budget for a page render.
 *
 * Re-measure with:
 *   SELECT COUNT(*) FROM players;  SELECT COUNT(*) FROM groups;
 *   SELECT COUNT(*) FROM drops WHERE date_added >= '2026-07-01';
 */
export const MEASURED = {
  asOf: "2026-07-25",
  playersTracked: 14_706,
  clansRegistered: 247,
  /** Submissions processed in July 2026 alone. */
  dropsThisMonth: 11_596_210,
} as const;

/** Anchor list for the side rail + in-page nav. */
export const SECTIONS = [
  { id: "capture", label: "Capture" },
  { id: "proof", label: "Proof" },
  { id: "boards", label: "Boards" },
  { id: "discord", label: "Discord" },
  { id: "events", label: "Events" },
  { id: "live", label: "Live" },
] as const;
