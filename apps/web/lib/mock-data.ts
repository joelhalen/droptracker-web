/**
 * Built-in mock payloads so the front-end is runnable before the Web API v1
 * exists (FRONTEND_PLAN.md Phase 0/1). Gated behind `USE_MOCK_API`; the client
 * falls back to these only when the real API is unreachable.
 */
import type {
  AccountSettings,
  AdminLookupResponse,
  AnnouncementPage,
  EventChannelConfig,
  EventCompletion,
  EventDetail,
  EventSummary,
  EventTaskLibraryItem,
  GroupDiagnostics,
  GroupEmbedsResponse,
  GroupMembersPage,
  GroupProfile,
  AuthorizedUsersResponse,
  GroupSubscription,
  UserSubscription,
  GuildStatus,
  LeaderboardPage,
  Lootboard,
  Me,
  PlayerLootTracker,
  PlayerProfile,
  SearchResults,
  ServiceLogs,
  ServiceStatus,
  SubscriptionTier,
  AdminTicketPage,
  TicketDetail,
  TicketPage,
  TicketSummary,
  WomGroupPreview,
  WomSyncResult,
} from "@droptracker/api-types";
import { EMBED_TYPES, GROUP_CONFIG_FIELDS } from "@droptracker/api-types";

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
    previous_month_loot: money(890_000_000),
    ranked_players: 25_000,
    top_bosses: [
      { npc_id: 8061, name: "Vorkath", loot: money(410_000_000), drops: 512 },
      { npc_id: 2042, name: "Zulrah", loot: money(260_000_000), drops: 388 },
      { npc_id: 12214, name: "Araxxor", loot: money(120_000_000), drops: 145 },
    ],
    personal_bests: [
      { npc_id: 12214, boss: "Araxxor", time_ms: 58800, time_display: "0:58.8", team_size: "Solo", date_ts: Math.floor(Date.now() / 1000) - 86400 },
      { npc_id: 8061, boss: "Vorkath", time_ms: 72400, time_display: "1:12.4", team_size: "Solo", date_ts: Math.floor(Date.now() / 1000) - 604800 },
    ],
    groups: [{ id: 2, name: "Global" }],
    recent_submissions: [
      {
        id: 1,
        type: "drop",
        label: "Twisted bow",
        value: money(1_100_000_000),
        image_url: "https://www.droptracker.io/img/itemdb/20997.png",
        npc_name: "Alchemical Hydra",
        ts: Math.floor(Date.now() / 1000) - 300,
      },
      { id: 2, type: "pet", label: "Vorki", npc_name: "Vorkath", ts: Math.floor(Date.now() / 1000) - 3600 },
      {
        id: 3,
        type: "clog",
        label: "Zaryte vambraces",
        value: money(28_000_000),
        image_url: "https://www.droptracker.io/img/itemdb/26235.png",
        ts: Math.floor(Date.now() / 1000) - 86400,
      },
    ],
  };
}

export function mockPlayerLoot(id: number, partition?: number): PlayerLootTracker {
  const now = new Date();
  const current = now.getFullYear() * 100 + now.getMonth() + 1;
  return {
    player_id: id,
    partition: partition ?? current,
    earliest_partition: 202601,
    npcs: [
      {
        npc_id: 8061,
        name: "Vorkath",
        kills: 214,
        loot: money(410_000_000),
        items: [
          { item_id: 22006, name: "Vorkath's head", quantity: 4, loot: money(120_000_000) },
          { item_id: 11286, name: "Draconic visage", quantity: 2, loot: money(9_800_000) },
          { item_id: 1613, name: "Dragon bones", quantity: 428, loot: money(1_100_000) },
        ],
      },
      {
        npc_id: 2042,
        name: "Zulrah",
        kills: 156,
        loot: money(260_000_000),
        items: [
          { item_id: 12934, name: "Zulrah's scales", quantity: 31_200, loot: money(4_600_000) },
          { item_id: 12922, name: "Tanzanite fang", quantity: 1, loot: money(2_400_000) },
        ],
      },
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
    discord_url: "https://www.droptracker.io/discord",
    top_player: { id: 1337, name: "Zezima", total_loot: money(2_000_000_000) },
    top_players: [
      { rank: 1, id: 1337, name: "Zezima", loot: money(2_000_000_000) },
      { rank: 2, id: 1338, name: "Woox", loot: money(1_400_000_000) },
      { rank: 3, id: 1339, name: "B0aty", loot: money(950_000_000) },
      { rank: 4, id: 1340, name: "Framed", loot: money(610_000_000) },
      { rank: 5, id: 1341, name: "Torvesta", loot: money(420_000_000) },
    ],
    top_bosses: [
      { npc_id: 10814, name: "Theatre of Blood", loot: money(3_100_000_000), drops: 812 },
      { npc_id: 8061, name: "Vorkath", loot: money(1_900_000_000), drops: 2140 },
      { npc_id: 2042, name: "Zulrah", loot: money(1_100_000_000), drops: 1660 },
      { npc_id: 12214, name: "Araxxor", loot: money(760_000_000), drops: 540 },
      { npc_id: 7554, name: "Corporeal Beast", loot: money(410_000_000), drops: 205 },
    ],
    records: [
      { npc_id: 12214, boss: "Araxxor", time_ms: 58800, time_display: "0:58.8", team_size: "Solo", holder: { id: 1337, name: "Zezima" }, date_ts: Math.floor(Date.now() / 1000) - 7200 },
      { npc_id: 10814, boss: "Theatre of Blood", time_ms: 872000, time_display: "14:32.0", team_size: "4", holder: { id: 1338, name: "Woox" }, date_ts: Math.floor(Date.now() / 1000) - 86400 },
      { npc_id: 8061, boss: "Vorkath", time_ms: 65100, time_display: "1:05.1", team_size: "Solo", holder: { id: 1339, name: "B0aty" }, date_ts: Math.floor(Date.now() / 1000) - 259200 },
    ],
    recent_submissions: [
      {
        id: 10,
        type: "drop",
        label: "Scythe of vitur",
        value: money(750_000_000),
        image_url: "https://www.droptracker.io/img/itemdb/22325.png",
        npc_name: "Theatre of Blood",
        player_id: 1337,
        player_name: "Zezima",
        ts: Math.floor(Date.now() / 1000) - 900,
      },
    ],
  };
}

export function mockMe(): Me {
  return {
    user_id: 1,
    discord_id: "207526562331885568",
    display_name: "MockUser",
    avatar_url: null,
    is_superadmin: true,
    is_supporter: true,
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
    hidden: false,
    global_ping: true,
    group_ping: true,
    never_ping: false,
    dm_account_changes: true,
    dm_drops: true,
    dm_pbs: true,
    dm_cas: false,
    dm_clogs: true,
    dm_pets: true,
    dm_quests: false,
    dm_deaths: false,
    dm_diaries: false,
    dm_levels: false,
    dm_min_value: 1_000_000,
    supporter_entitlements: { dm_submissions: true, supporter_flair: true, video_submissions: true },
    players: [
      { id: 1, name: "Mock Player", hidden: false },
      { id: 2, name: "Mock Alt", hidden: true },
    ],
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

export function mockSubscriptionTiers(): SubscriptionTier[] {
  return [
    {
      key: "free",
      name: "Free",
      description: "Core drop tracking for every clan.",
      scope: "group",
      price_cents: 0,
      currency: "USD",
      interval: "month",
      features: ["Live leaderboards", "Drop notifications", "Public group page"],
      entitlements: { events: false, hall_of_fame: false },
      recommended: false,
    },
    {
      key: "premium",
      name: "Premium",
      description: "Custom embeds, the Hall of Fame, and more for your clan.",
      scope: "group",
      price_cents: 500,
      currency: "USD",
      interval: "month",
      features: [
        "Everything in Free",
        "Seasonal lootboards",
        "Extended submission history",
        "Custom board themes",
      ],
      entitlements: { events: true, hall_of_fame: true },
      recommended: true,
    },
    {
      key: "premium_plus",
      name: "Premium+",
      description: "For large, competitive clans.",
      scope: "group",
      price_cents: 1500,
      currency: "USD",
      interval: "month",
      features: [
        "Everything in Premium",
        "Unlimited members",
        "Advanced analytics",
        "Early access to new features",
      ],
      entitlements: { events: true, hall_of_fame: true },
      recommended: false,
    },
  ];
}

export function mockAuthorizedUsers(): AuthorizedUsersResponse {
  return {
    users: [
      {
        user_id: 1,
        discord_id: "207526562331885568",
        username: "mockowner",
        role: "owner",
        sources: ["web", "discord"],
      },
      {
        user_id: 2,
        discord_id: "528746710042804247",
        username: "mockadmin",
        role: "admin",
        sources: ["discord"],
      },
    ],
  };
}

export function mockGroupSubscription(groupId: number): GroupSubscription {
  return {
    group_id: groupId,
    tier_key: "premium",
    status: "active",
    provider: "stripe",
    current_period_end: Math.floor(Date.now() / 1000) + 18 * 86400,
    cancel_at_period_end: false,
    entitlements: { events: true, hall_of_fame: true, custom_embeds: true },
  };
}

export function mockUserSubscription(): UserSubscription {
  return {
    user_id: 1,
    tier_key: "supporter",
    status: "active",
    provider: "stripe",
    amount_cents: 750,
    current_period_end: Math.floor(Date.now() / 1000) + 18 * 86400,
    cancel_at_period_end: false,
    entitlements: { dm_submissions: true, supporter_flair: true, video_submissions: true },
  };
}

export function mockGroupEmbeds(): GroupEmbedsResponse {
  return {
    embeds: EMBED_TYPES.map((embed_type) => ({
      embed_type,
      custom:
        embed_type === "drop"
          ? {
              embed_type,
              title: "{item_name} — nice drop!",
              description: "**{player_name}** just received **{item_name}** from {npc_name}!",
              color: "#ffb83f",
              thumbnail: "https://static.runelite.net/cache/item/icon/{item_id}.png",
              image: null,
              timestamp: true,
              fields: [
                { name: "Value", value: "{total_value} gp", inline: true },
                { name: "Group rank", value: "#{group_rank}", inline: true },
              ],
            }
          : null,
      default: {
        embed_type,
        title: "{player_name} — new {item_name}",
        description: "Default DropTracker notification.",
        color: "#7a5a32",
        thumbnail: null,
        image: null,
        timestamp: false,
        fields: [{ name: "Player", value: "{player_name}", inline: true }],
      },
    })),
  };
}

export function mockServices(): ServiceStatus[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    { unit: "droptracker-core", name: "Core processor", status: "running", active: true, since: now - 86400 * 3 },
    { unit: "droptracker-api", name: "Intake API", status: "running", active: true, since: now - 86400 * 3 },
    { unit: "droptracker-webhooks", name: "Webhooks / notifications", status: "running", active: true, since: now - 3600 },
  ];
}

export function mockServiceLogs(unit: string): ServiceLogs {
  const now = new Date();
  const lines = Array.from({ length: 20 }, (_, i) => {
    const t = new Date(now.getTime() - (20 - i) * 1000).toISOString().slice(11, 19);
    return `${t} ${unit}[1234]: processed batch ${1000 + i} ok`;
  });
  return { unit, lines };
}

export function mockLootboard(groupId: number, period: string): Lootboard {
  const ITEMS: [number, string, number][] = [
    [20997, "Twisted bow", 1_100_000_000],
    [22486, "Scythe of vitur", 750_000_000],
    [27277, "Tumeken's shadow", 1_050_000_000],
    [11802, "Armadyl godsword", 18_000_000],
    [12924, "Toxic blowpipe", 4_500_000],
    [4151, "Abyssal whip", 1_800_000],
    [11785, "Armadyl crossbow", 32_000_000],
    [21006, "Dragon hunter lance", 60_000_000],
    [13652, "Dragon claws", 95_000_000],
    [11926, "Occult necklace", 600_000],
    [25738, "Masori body", 60_000_000],
    [19481, "Hydra leather", 18_000],
  ];
  const icon = (id: number) => `https://www.droptracker.io/img/itemdb/${id}.png`;
  const items = ITEMS.map(([item_id, name, unit], i) => {
    const quantity = 1 + ((i * 7) % 11);
    const total = unit * quantity;
    return { item_id, name, quantity, value: money(total), icon_url: icon(item_id), is_coin: false };
  });
  const total = items.reduce((s, it) => s + it.value.value, 0);

  const PLAYERS = [
    "Zezima", "B0aty", "Woox", "Framed", "SkillSpecs", "Odablock",
    "Torvesta", "Faux", "Settled", "Mr Mammal", "A Friend", "Solomission",
  ];
  const leaderboard = PLAYERS.map((player_name, i) => ({
    rank: i + 1,
    player_id: 1000 + i,
    player_name,
    total: money(Math.round(total / (i + 2))),
  }));

  const now = Date.now();
  const recent_drops = items.slice(0, 12).map((it, i) => ({
    item_id: it.item_id,
    name: it.name,
    icon_url: it.icon_url,
    player_id: 1000 + (i % PLAYERS.length),
    player_name: PLAYERS[i % PLAYERS.length] ?? "Unknown",
    quantity: 1,
    value: money(it.value.value),
    date_added: new Date(now - i * 47 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "),
  }));

  return {
    group_id: groupId,
    period,
    total: money(total),
    items,
    background_url: "https://www.droptracker.io/img/lootboard/bank-new-clean-dark.png",
    canvas: { width: 1074, height: 795 },
    header: `Mock Clan's Tracked Drops for ${period === "all" ? "All Time" : period} - `,
    use_gp_colors: true,
    use_dynamic_colors: false,
    recent_drops,
    leaderboard,
  };
}

const DAY = 86400;

export function mockEvents(groupId?: number, status?: string): EventSummary[] {
  const now = Math.floor(Date.now() / 1000);
  const eventDefaults = {
    formation_mode: "self_join" as const,
    requires_confirmation: false,
    board_size: 5,
    bonus_line_points: 10,
    bonus_blackout_points: 100,
  };
  const all: EventSummary[] = [
    {
      id: 1,
      group_id: groupId ?? 101,
      name: "Summer Bingo 2026",
      description: "A 5×5 bingo of bossing and skilling tasks.",
      status: "active",
      starts_at: now - 3 * DAY,
      ends_at: now + 11 * DAY,
      has_bingo: true,
      activated_at: now - 3 * DAY,
      ...eventDefaults,
    },
    {
      id: 2,
      group_id: groupId ?? 101,
      name: "Spring Boss Race",
      description: "Most KC across the GWD bosses wins.",
      status: "past",
      starts_at: now - 40 * DAY,
      ends_at: now - 26 * DAY,
      has_bingo: false,
      activated_at: now - 40 * DAY,
      ended_at: now - 26 * DAY,
      ...eventDefaults,
    },
  ];
  return all.filter((e) => (status ? e.status === status : true));
}

export function mockEvent(id: number): EventDetail {
  const now = Math.floor(Date.now() / 1000);
  const summary = mockEvents().find((e) => e.id === id) ?? mockEvents()[0]!;
  const cells = Array.from({ length: 25 }, (_, i) => ({
    index: i,
    label: ["Twisted bow", "Any pet", "99 Slayer", "Vorkath 50kc", "Inferno cape"][i % 5]!,
    task_id: i % 5 === 0 ? 12 : null,
    completed_by: i % 4 === 0 ? ["Team Red"] : i % 7 === 0 ? ["Team Blue"] : [],
    completions:
      i % 4 === 0
        ? [
            {
              team_id: 21,
              team_name: "Team Red",
              player_id: 1337,
              player_name: "Zezima",
              completed_at: now - i * 3600,
            },
          ]
        : i % 7 === 0
          ? [{ team_id: 22, team_name: "Team Blue", player_id: 2003, player_name: "Framed", completed_at: now - 7200 }]
          : [],
  }));
  return {
    ...summary,
    id,
    tasks: [
      { id: 11, type: "kc_target", label: "Vorkath 50 KC", target: "Vorkath", target_value: 50, points: 10, requires_confirmation: false },
      { id: 12, type: "item_collection", label: "Obtain a Twisted bow", target: "Twisted bow", points: 50, requires_confirmation: true },
      { id: 13, type: "skill_target", label: "Reach 99 Slayer", target: "Slayer", target_value: 99, points: 25, requires_confirmation: false },
      { id: 14, type: "xp_target", label: "Gain 10M Ranged XP", target: "Ranged", target_value: 10_000_000, points: 15, requires_confirmation: false },
    ],
    teams: [
      {
        id: 21,
        name: "Team Red",
        score: 120,
        member_count: 3,
        members: [
          { player_id: 1337, player_name: "Zezima", joined_at: now - 3 * DAY },
          { player_id: 2001, player_name: "Woox", joined_at: now - 2 * DAY },
          { player_id: 2002, player_name: "B0aty", joined_at: now - 2 * DAY },
        ],
      },
      {
        id: 22,
        name: "Team Blue",
        score: 95,
        member_count: 2,
        members: [
          { player_id: 2003, player_name: "Framed", joined_at: now - 3 * DAY },
          { player_id: 2004, player_name: "Settled", joined_at: now - DAY },
        ],
      },
      { id: 23, name: "Team Green", score: 60, member_count: 0, members: [] },
    ],
    bingo: summary.has_bingo ? { size: 5, cells } : null,
    viewer: { player_ids_on_event: [1337], team_id: 21 },
    join_requires_code: false,
    join_code: null,
    starts_at: summary.starts_at ?? now,
    ends_at: summary.ends_at ?? now + 7 * DAY,
  };
}

/** Admin-only completion ledger (Task 18 verification queue). */
export function mockEventCompletions(eventId: number, status?: string): EventCompletion[] {
  const now = Math.floor(Date.now() / 1000);
  const all: EventCompletion[] = [
    {
      id: 501,
      event_id: eventId,
      task_id: 12,
      task_label: "Obtain a Twisted bow",
      team_id: 21,
      team_name: "Team Red",
      player_id: 1337,
      player_name: "Zezima",
      status: "pending",
      quantity: 1,
      source_type: "drop",
      submission_guid: "mock-guid-501",
      proof_url: "https://www.droptracker.io/img/itemdb/20997.png",
      created_at: now - 1800,
    },
    {
      id: 502,
      event_id: eventId,
      task_id: 11,
      task_label: "Vorkath 50 KC",
      team_id: 22,
      team_name: "Team Blue",
      player_id: 1338,
      player_name: "Zezima Alt",
      status: "auto",
      quantity: 1,
      source_type: "drop",
      submission_guid: "mock-guid-502",
      created_at: now - 7200,
    },
    {
      id: 503,
      event_id: eventId,
      task_id: 13,
      task_label: "Reach 99 Slayer",
      team_id: 21,
      team_name: "Team Red",
      player_id: null,
      status: "manual",
      quantity: 1,
      source_type: "manual",
      note: "Awarded after screenshot proof in Discord",
      created_at: now - 86400,
    },
  ];
  return status && status !== "all" ? all.filter((c) => c.status === status) : all;
}

/** Curated task presets for the bingo designer picker (Task 20). */
export function mockEventTaskLibrary(query?: string, type?: string): EventTaskLibraryItem[] {
  const all: EventTaskLibraryItem[] = [
    { id: 1, name: "Abyssal whip", description: "Obtain an Abyssal whip", type: "item_collection", target: "Abyssal whip", target_value: 1, default_points: 5, difficulty: "air", config: null },
    { id: 2, name: "Full Barrows set", description: "Collect any complete Barrows set", type: "item_collection", target: null, target_value: null, default_points: 25, difficulty: "earth", config: '{"kind":"any_of","items":["Dharok\'s helm","Dharok\'s platebody"]}' },
    { id: 3, name: "Zulrah 50 KC", description: "Kill Zulrah 50 times", type: "kc_target", target: "Zulrah", target_value: 50, default_points: 15, difficulty: "water", config: null },
    { id: 4, name: "Sub-20 Grotesque Guardians", description: "Beat the Guardians in under 20 minutes", type: "pb_target", target: "Grotesque Guardians", target_value: 1200, default_points: 30, difficulty: "fire", config: null },
    { id: 5, name: "Twisted bow", description: "Obtain a Twisted bow", type: "item_collection", target: "Twisted bow", target_value: 1, default_points: 100, difficulty: "fire", config: null },
  ];
  const q = (query ?? "").trim().toLowerCase();
  return all.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)) &&
      (!type || i.type === type),
  );
}

/** Per-event Discord destinations (Task 19). */
export function mockEventDiscord(_eventId: number): EventChannelConfig {
  return {
    guild_id: "444444444444444444",
    guild_name: "Mock Clan Server",
    channels: {
      announcements: "333333333333333333",
      completions: "111111111111111111",
    },
  };
}

export function mockEventDiscordGuilds() {
  return {
    guilds: [
      { id: "444444444444444444", name: "Mock Clan Server", icon: null },
      { id: "555555555555555555", name: "Mock Event Server", icon: null },
    ],
    stale: false,
  };
}

export function mockEventDiscordChannels(_guildId: string) {
  return {
    channels: [
      { id: "111111111111111111", name: "drops", position: 0 },
      { id: "222222222222222222", name: "leaderboard", position: 1 },
      { id: "333333333333333333", name: "announcements", position: 2 },
    ],
    stale: false,
  };
}

export function mockLookup(q: string): AdminLookupResponse {
  return {
    results: [
      { category: "player", id: "1337", label: `Zezima (matches "${q}")`, detail: "rank #1", href: "/players/1337" },
      { category: "group", id: "101", label: `Clan 1`, detail: "128 members", href: "/groups/101" },
      { category: "item", id: "20997", label: "Twisted bow", detail: "item #20997" },
      { category: "npc", id: "8061", label: "Vorkath", detail: "npc #8061" },
      { category: "drop", id: "55012", label: "Tumeken's shadow", detail: "by Zezima · 1.1B" },
    ],
  };
}

// --- Support tickets (web21a) ----------------------------------------------

const MOCK_NOW = 1_751_900_000; // stable seed so contract tests are deterministic

function mockTicketSummary(id: number, status: "open" | "closed" = "open"): TicketSummary {
  return {
    ticket_id: id,
    type: id % 2 ? "players" : "support",
    status,
    subject: `My drops stopped tracking after a name change (#${id})`,
    created_by: 42,
    created_by_name: "zezima",
    claimed_by: status === "open" ? null : 1,
    claimed_by_name: status === "open" ? null : "joelhalen",
    closed_by: status === "closed" ? 1 : null,
    closed_by_name: status === "closed" ? "joelhalen" : null,
    message_count: 6,
    date_added: MOCK_NOW - 86_400 * id,
    date_updated: MOCK_NOW - 3_600 * id,
    date_closed: status === "closed" ? MOCK_NOW - 1_800 * id : null,
  };
}

export function mockMyTickets(page = 1): TicketPage {
  return {
    items: [mockTicketSummary(3, "open"), mockTicketSummary(2, "closed")],
    meta: { page, limit: 25, total: 2 },
  };
}

export function mockTicket(ticketId: number): TicketDetail {
  return {
    ...mockTicketSummary(ticketId, "closed"),
    messages: [
      {
        id: 1,
        author_name: "DropTracker",
        author_user_id: null,
        is_staff: true,
        is_bot: true,
        kind: "message",
        content: "Hey! The support team will be with you shortly.",
        attachments: [],
        date_sent: MOCK_NOW - 90_000,
        date_edited: null,
      },
      {
        id: 2,
        author_name: "zezima",
        author_user_id: 42,
        is_staff: false,
        is_bot: false,
        kind: "message",
        content: "I changed my RSN yesterday and my drops stopped tracking.",
        attachments: [
          { filename: "screenshot.png", url: "/img/tickets/1/screenshot.png", content_type: "image/png", size: 12345 },
        ],
        date_sent: MOCK_NOW - 89_000,
        date_edited: null,
      },
      {
        id: 3,
        author_name: "joelhalen",
        author_user_id: 1,
        is_staff: true,
        is_bot: false,
        kind: "message",
        content: "Fixed — your accounts are linked again. Give it a minute!",
        attachments: [],
        date_sent: MOCK_NOW - 80_000,
        date_edited: null,
      },
      {
        id: 4,
        author_name: "DropTracker",
        author_user_id: null,
        is_staff: true,
        is_bot: true,
        kind: "system",
        content: "Ticket closed by joelhalen",
        attachments: [],
        date_sent: MOCK_NOW - 79_000,
        date_edited: null,
      },
    ],
  };
}

export function mockAdminTickets(page = 1): AdminTicketPage {
  return {
    ...mockMyTickets(page),
    stats: {
      open: 3,
      unclaimed: 2,
      closed: 311,
      total: 314,
      open_by_type: { players: 2, support: 1 },
    },
  };
}
