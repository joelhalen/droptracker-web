/**
 * Built-in mock payloads so the front-end is runnable before the Web API v1
 * exists (FRONTEND_PLAN.md Phase 0/1). Gated behind `USE_MOCK_API`; the client
 * falls back to these only when the real API is unreachable.
 */
import type {
  AccountSettings,
  AnnouncementPage,
  GroupDiagnostics,
  GroupMembersPage,
  GroupProfile,
  GuildStatus,
  LeaderboardPage,
  Me,
  PlayerProfile,
  SearchResults,
  WomGroupPreview,
  WomSyncResult,
} from "@droptracker/api-types";
import { GROUP_CONFIG_FIELDS } from "@droptracker/api-types";

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

export function mockMe(): Me {
  return {
    user_id: 1,
    discord_id: "207526562331885568",
    display_name: "MockUser",
    avatar_url: null,
    players: [
      { id: 1337, name: "Zezima", global_rank: 1, total_loot: money(2_000_000_000) },
      { id: 1338, name: "Zezima Alt", global_rank: 482, total_loot: money(86_000_000) },
    ],
    groups: [
      { id: 2, name: "Global", role: "member" },
      { id: 101, name: "Clan 1", role: "owner" },
      { id: 102, name: "Clan 2", role: "admin" },
    ],
  };
}

export function mockAccountSettings(): AccountSettings {
  return {
    public: true,
    hidden: false,
    global_ping: true,
    group_ping: true,
    never_ping: false,
    dm_on_rank_change: false,
    dm_on_points: true,
    update_logs_opt_in: true,
    patreon_group: 101,
    premium_group: 101,
  };
}

export function mockSearch(q: string): SearchResults {
  const term = q.toLowerCase();
  return {
    players: NAMES.filter((n) => n.toLowerCase().includes(term))
      .slice(0, 5)
      .map((name, i) => ({
        id: 1000 + i,
        name,
        global_rank: i + 1,
        total_loot: money(500_000_000 / (i + 1)),
      })),
    groups: [{ id: 101, name: `Clan matching "${q}"`, member_count: 128 }],
  };
}

/** Mock config: every key set to its registry default. */
export function mockGroupConfig(): Record<string, string | number | boolean | null> {
  return Object.fromEntries(GROUP_CONFIG_FIELDS.map((f) => [f.key, f.default]));
}

export function mockAnnouncements(scope = "global"): AnnouncementPage {
  const isGroup = scope.startsWith("group:");
  const groupId = isGroup ? Number(scope.split(":")[1]) : null;
  return {
    items: isGroup
      ? [
          {
            id: 100 + (groupId ?? 0),
            scope_type: "group",
            group_id: groupId,
            title: "Clan event this weekend",
            body_md: "We're running a bossing mass on Saturday. Sign up in Discord!",
            pinned: false,
            author_name: "Clan Staff",
            published_at: 1718990000,
          },
        ]
      : [
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

export function mockGroupMembers(_groupId: number, page = 1, limit = 25): GroupMembersPage {
  const members = Array.from({ length: limit }, (_, i) => {
    const n = (page - 1) * limit + i;
    return {
      id: 2000 + n,
      name: `${NAMES[n % NAMES.length]}${n}`,
      group_rank: i === 0 ? "Owner" : i < 3 ? "Admin" : "Member",
      total_loot: money(Math.round(500_000_000 / (n + 1))),
      hidden: n % 11 === 0,
    };
  });
  return { members, meta: { page, limit, total: 128 } };
}

export function mockWomSync(): WomSyncResult {
  return { added: 3, removed: 1, total: 128, synced_ts: Math.floor(Date.now() / 1000) };
}

export function mockDiagnostics(): GroupDiagnostics {
  const today = Math.floor(Date.now() / 86_400_000);
  return {
    intake_healthy: true,
    last_submission_ts: Math.floor(Date.now() / 1000) - 120,
    members_synced_ts: Math.floor(Date.now() / 1000) - 3600,
    activity_7d: Array.from({ length: 7 }, (_, i) => ({
      date: new Date((today - (6 - i)) * 86_400_000).toISOString().slice(0, 10),
      submissions: Math.round(50 + Math.random() * 200),
    })),
    warnings: [],
  };
}

export function mockWomLookup(womId: number): WomGroupPreview {
  return {
    wom_id: womId,
    name: `WOM Group ${womId}`,
    member_count: 84,
    already_registered: womId % 7 === 0,
  };
}

export function mockGuildStatus(guildId: string): GuildStatus {
  return {
    guild_id: guildId,
    bot_present: true,
    owns_group: false,
    group_id: null,
  };
}
