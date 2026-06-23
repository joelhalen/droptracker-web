/**
 * Built-in mock payloads so the front-end is runnable before the Web API v1
 * exists (FRONTEND_PLAN.md Phase 0/1). Gated behind `USE_MOCK_API`; the client
 * falls back to these only when the real API is unreachable.
 */
import type {
  AnnouncementPage,
  GroupProfile,
  LeaderboardPage,
  PlayerProfile,
} from "@droptracker/api-types";

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const money = (value: number) => ({ value, value_formatted: fmt(value) });

const NAMES = [
  "Zezima",
  "B0aty",
  "Woox",
  "Framed",
  "SkillSpecs",
  "Settled",
  "C Engineer",
  "Faux",
  "Torvesta",
  "Mmorpg",
];

export function mockPlayerLeaderboard(page = 1, limit = 25): LeaderboardPage {
  const entries = Array.from({ length: limit }, (_, i) => {
    const rank = (page - 1) * limit + i + 1;
    const loot = Math.round(2_500_000_000 / rank);
    return {
      rank,
      id: 1000 + rank,
      name: `${NAMES[rank % NAMES.length]}${rank > NAMES.length ? rank : ""}`,
      loot: money(loot),
      delta: rank <= 5 ? Math.round(loot * 0.01) : 0,
    };
  });
  return {
    period: "all",
    scope: "global",
    entries,
    meta: { page, limit, total: 5000 },
  };
}

export function mockGroupLeaderboard(page = 1, limit = 25): LeaderboardPage {
  const entries = Array.from({ length: limit }, (_, i) => {
    const rank = (page - 1) * limit + i + 1;
    const loot = Math.round(40_000_000_000 / rank);
    return {
      rank,
      id: 100 + rank,
      name: `Clan ${rank}`,
      loot: money(loot),
    };
  });
  return { period: "all", scope: "global", entries, meta: { page, limit, total: 800 } };
}

export function mockPlayerProfile(id: number): PlayerProfile {
  return {
    id,
    name: NAMES[id % NAMES.length] ?? `Player ${id}`,
    global_rank: (id % 500) + 1,
    total_loot: money(1_234_567_890),
    points: 4200,
    top_npc: "Vorkath",
    groups: [{ id: 2, name: "Global" }],
    recent_submissions: [
      { id: 1, type: "drop", label: "Twisted bow", value: money(1_100_000_000), ts: 1719000000 },
      { id: 2, type: "pet", label: "Vorki", ts: 1718990000 },
      { id: 3, type: "clog", label: "Zaryte vambraces", value: money(28_000_000), ts: 1718980000 },
    ],
  };
}

export function mockGroupProfile(id: number): GroupProfile {
  return {
    id,
    name: `Clan ${id}`,
    description: "A mock clan profile served while the Web API is unavailable.",
    member_count: 128,
    global_rank: (id % 100) + 1,
    monthly_loot: money(9_870_000_000),
    discord_url: "https://discord.gg/droptracker",
    top_player: { id: 1337, name: "Zezima", total_loot: money(2_000_000_000) },
    recent_submissions: [
      { id: 10, type: "drop", label: "Scythe of vitur", value: money(750_000_000), ts: 1719000000 },
    ],
  };
}

export function mockAnnouncements(): AnnouncementPage {
  return {
    items: [
      {
        id: 1,
        scope_type: "global",
        title: "Welcome to the new DropTracker",
        body_md:
          "The site is being rebuilt on a real-time, Discord-native platform. Leaderboards now update live.",
        pinned: true,
        author_name: "DropTracker Team",
        published_at: 1719000000,
      },
    ],
    next_cursor: null,
  };
}
