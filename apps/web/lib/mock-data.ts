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
  EventTeamDiscordConfig,
  EventCompletion,
  EventDetail,
  EventTeamDetail,
  EventTeamsResponse,
  EventPlayersResponse,
  EventPlayerRow,
  EventPlayerItem,
  EventPlayerDetail,
  EventSignup,
  EventSummary,
  EventTaskLibraryItem,
  EventTemplateSummary,
  EventTemplateDetail,
  GroupDiagnostics,
  GroupEmbedsResponse,
  EventLayoutMeta,
  EventLayoutsResponse,
  EventMessageLayout,
  GroupEventLayoutsResponse,
  GroupMembersPage,
  GroupProfile,
  AuthorizedUsersResponse,
  EventManagersResponse,
  GroupSubscription,
  GroupSubscriptionSummary,
  AdminSubscriptionsOverview,
  UserSubscription,
  BotInvite,
  ClaimPreview,
  ClaimResult,
  GuildStatus,
  ManageableGuild,
  LeaderboardPage,
  Lootboard,
  LootSweepBoard,
  LootSweepGroup,
  LootSweepReceipts,
  LootSweepSet,
  ManualSubmissionQueue,
  Me,
  ItemDetail,
  NpcDetail,
  NpcDropTable,
  PlayerLootTracker,
  PlayerProfile,
  SearchResults,
  ResolveResult,
  B2Usage,
  BackupOffsite,
  BackupOverview,
  ServiceLogs,
  ServiceStatus,
  SubscriptionTier,
  SuggestionDetail,
  PbBossBoard,
  PbBossIndex,
  SuggestionPage,
  SuggestionSummary,
  Supporters,
  AdminTicketPage,
  TicketDetail,
  TicketPage,
  TicketSummary,
  WomGroupPreview,
  WomSyncResult,
} from "@droptracker/api-types";
import { EMBED_TYPES, GROUP_CONFIG_FIELDS } from "@droptracker/api-types";
import { defaultMaxAwards, itemTotal } from "./loot-sweep";
import { slugify } from "./slug";

const fmt = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const money = (value: number) => ({ value: Math.floor(value), value_formatted: fmt(value) });

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

// A few mock clans carry subscription flair so the leaderboard renders the tier
// treatment in mock mode (USE_MOCK_API=true). Keyed by rank on page 1.
const MOCK_GROUP_FLAIR: Record<number, LeaderboardPage["entries"][number]["flair"]> = {
  1: { tier_key: "premium_plus", tier_name: "Premium+", style: "dragon" },
  2: { tier_key: "premium", tier_name: "Premium", style: "amethyst" },
  3: { tier_key: "premium", tier_name: "Premium", style: "gold" },
  5: { tier_key: "premium", tier_name: "Premium", style: "bronze" },
};

export function mockGroupLeaderboard(page = 1, limit = 25): LeaderboardPage {
  const entries = Array.from({ length: limit }, (_, i) => {
    const rank = (page - 1) * limit + i + 1;
    const loot = Math.round(40_000_000_000 / rank);
    return {
      rank,
      id: 100 + rank,
      name: `Clan ${rank}`,
      loot: money(loot),
      flair: page === 1 ? MOCK_GROUP_FLAIR[rank] : undefined,
    };
  });
  return { period: "all", scope: "global", entries, meta: { page, limit, total: 800 } };
}

export function mockPlayerProfile(id: number): PlayerProfile {
  const name = NAMES[id % NAMES.length] ?? `Player ${id}`;
  return {
    id,
    name,
    canonical_slug: slugify(name),
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
      {
        npc_id: 12214,
        boss: "Araxxor",
        time_ms: 58800,
        time_display: "0:58.8",
        team_size: "Solo",
        date_ts: Math.floor(Date.now() / 1000) - 86400,
      },
      {
        npc_id: 8061,
        boss: "Vorkath",
        time_ms: 72400,
        time_display: "1:12.4",
        team_size: "Solo",
        date_ts: Math.floor(Date.now() / 1000) - 604800,
      },
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
      {
        id: 2,
        type: "pet",
        label: "Vorki",
        npc_name: "Vorkath",
        ts: Math.floor(Date.now() / 1000) - 3600,
      },
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
  const ts = Math.floor(Date.now() / 1000);
  const daysAgo = (d: number) => ts - d * 86400;
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
          {
            item_id: 22006,
            name: "Vorkath's head",
            quantity: 4,
            loot: money(120_000_000),
            drops: 4,
            first_ts: daysAgo(24),
            last_ts: daysAgo(2),
          },
          {
            item_id: 11286,
            name: "Draconic visage",
            quantity: 2,
            loot: money(9_800_000),
            drops: 2,
            first_ts: daysAgo(18),
            last_ts: daysAgo(6),
          },
          {
            item_id: 1613,
            name: "Dragon bones",
            quantity: 428,
            loot: money(1_100_000),
            drops: 214,
            first_ts: daysAgo(27),
            last_ts: daysAgo(0),
          },
        ],
      },
      {
        npc_id: 2042,
        name: "Zulrah",
        kills: 156,
        loot: money(260_000_000),
        items: [
          {
            item_id: 12934,
            name: "Zulrah's scales",
            quantity: 31_200,
            loot: money(4_600_000),
            drops: 156,
            first_ts: daysAgo(25),
            last_ts: daysAgo(1),
          },
          {
            item_id: 12922,
            name: "Tanzanite fang",
            quantity: 1,
            loot: money(2_400_000),
            drops: 1,
            first_ts: daysAgo(9),
            last_ts: daysAgo(9),
          },
        ],
      },
    ],
  };
}

export function mockGroupProfile(id: number): GroupProfile {
  return {
    id,
    name: `Clan ${id}`,
    canonical_slug: slugify(`Clan ${id}`),
    description: "A mock clan profile served while the Web API is unavailable.",
    member_count: 128,
    global_rank: (id % 100) + 1,
    monthly_loot: money(9_870_000_000),
    discord_url: "https://www.droptracker.io/discord",
    flair: { tier_key: "premium", tier_name: "Premium", style: "gold" },
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
      {
        npc_id: 12214,
        boss: "Araxxor",
        time_ms: 58800,
        time_display: "0:58.8",
        team_size: "Solo",
        holder: { id: 1337, name: "Zezima" },
        date_ts: Math.floor(Date.now() / 1000) - 7200,
      },
      {
        npc_id: 10814,
        boss: "Theatre of Blood",
        time_ms: 872000,
        time_display: "14:32.0",
        team_size: "4",
        holder: { id: 1338, name: "Woox" },
        date_ts: Math.floor(Date.now() / 1000) - 86400,
      },
      {
        npc_id: 8061,
        boss: "Vorkath",
        time_ms: 65100,
        time_display: "1:05.1",
        team_size: "Solo",
        holder: { id: 1339, name: "B0aty" },
        date_ts: Math.floor(Date.now() / 1000) - 259200,
      },
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
    is_moderator: true,
    is_supporter: true,
    players: [
      { id: 1337, name: "Zezima", global_rank: 1, total_loot: money(2_000_000_000) },
      { id: 1338, name: "Zezima Alt", global_rank: 482, total_loot: money(86_000_000) },
    ],
    groups: [
      { id: 2, name: "Global", role: "member", can_manage_events: false },
      {
        id: 101,
        name: "Clan 1",
        role: "owner",
        can_manage_events: true,
        flair: { tier_key: "premium", tier_name: "Premium", style: "gold" },
      },
      { id: 102, name: "Clan 2", role: "admin", can_manage_events: true },
      // A group where the user is only an event manager (member + the flag).
      { id: 103, name: "Clan 3", role: "member", can_manage_events: true },
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
    dm_delivery_issue: false,
    supporter_entitlements: {
      dm_submissions: true,
      supporter_flair: true,
      video_submissions: true,
    },
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
    groups: [
      {
        id: 101,
        name: `Clan matching "${q}"`,
        member_count: 128,
        flair: { tier_key: "premium", tier_name: "Premium", style: "gold" },
      },
    ],
    npcs: [
      { id: 8060, name: "Vorkath", icon_url: "https://www.droptracker.io/img/npcdb/8060.png" },
      { id: 2042, name: "Zulrah", icon_url: "https://www.droptracker.io/img/npcdb/2042.png" },
    ],
    items: [
      {
        id: 20997,
        name: "Twisted bow",
        icon_url: "https://www.droptracker.io/img/itemdb/20997.png",
      },
      {
        id: 22006,
        name: "Skeletal visage",
        icon_url: "https://www.droptracker.io/img/itemdb/22006.png",
      },
    ],
  };
}

/**
 * Mock slug resolution. Derives a deterministic id from the slug so pretty URLs
 * round-trip in mock mode. A slug containing "dup" simulates a name collision
 * (two candidates) so the disambiguation page is testable without a live DB.
 */
export function mockResolve(
  kind: "group" | "player" | "npc" | "item",
  slug: string,
): ResolveResult {
  const cleaned = slugify(slug);
  const title = cleaned
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
  const baseId =
    (Math.abs([...cleaned].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 900) + 100;

  if ((kind === "group" || kind === "player") && cleaned.includes("dup")) {
    const candidates =
      kind === "group"
        ? [
            { id: baseId, name: title, member_count: 128, created_ts: 1_700_000_000 },
            { id: baseId + 1, name: title, member_count: 12, created_ts: 1_760_000_000 },
          ]
        : [
            { id: baseId, name: title, total_loot: money(2_000_000_000) },
            { id: baseId + 1, name: title, total_loot: money(50_000_000) },
          ];
    return { kind, slug: cleaned, match: null, candidates };
  }

  if (!cleaned) return { kind, slug: cleaned, match: null, candidates: [] };
  const match = { id: baseId, name: title };
  return { kind, slug: cleaned, match, candidates: [match] };
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

/** Guild ids ending in "0" simulate the invite-bot flow: absent for the first
 * two polls, then present — so the wizard's poll-until-present path is
 * exercisable in mock mode. */
const guildStatusPolls = new Map<string, number>();

export function mockGuildStatus(guildId: string): GuildStatus {
  let botPresent = true;
  if (guildId.endsWith("0")) {
    const polls = (guildStatusPolls.get(guildId) ?? 0) + 1;
    guildStatusPolls.set(guildId, polls);
    botPresent = polls > 2;
  }
  return {
    guild_id: guildId,
    bot_present: botPresent,
    owns_group: guildId.endsWith("9"),
    group_id: guildId.endsWith("9") ? 1 : null,
  };
}

export function mockManageableGuilds(): ManageableGuild[] {
  return [
    {
      id: "207526562331885568",
      name: "Mock Clan HQ",
      icon_url: null,
      has_group: false,
      group_id: null,
    },
    {
      id: "207526562331885560",
      name: "Botless Server",
      icon_url: null,
      has_group: false,
      group_id: null,
    },
    {
      id: "207526562331885569",
      name: "Already Registered",
      icon_url: null,
      has_group: true,
      group_id: 1,
    },
  ];
}

export function mockBotInvite(): BotInvite {
  return {
    client_id: "1172933457010245762",
    permissions: null,
    invite_url:
      "https://discord.com/oauth2/authorize?client_id=1172933457010245762&scope=bot+applications.commands",
  };
}

/** Magic RSN prefixes exercise every claim branch in mock mode:
 * "new…" -> not_found, "taken…" -> claimed_by_other, "mine…" -> already_yours,
 * anything else -> claimable (with a clan attach when it starts with "clan"). */
function claimStatusFor(rsn: string): ClaimPreview["status"] {
  const r = rsn.trim().toLowerCase();
  if (r.startsWith("new")) return "not_found";
  if (r.startsWith("taken")) return "claimed_by_other";
  if (r.startsWith("mine")) return "already_yours";
  return "claimable";
}

export function mockClaimPreview(rsn: string): ClaimPreview {
  const status = claimStatusFor(rsn);
  return {
    status,
    player: status === "not_found" ? null : { id: 4242, name: rsn.trim() },
    group:
      status === "claimable" && rsn.trim().toLowerCase().startsWith("clan")
        ? { id: 7, name: "Mock Clan" }
        : null,
  };
}

export function mockClaimResult(rsn: string): ClaimResult {
  const preview = mockClaimPreview(rsn);
  const status = preview.status === "claimable" ? "claimed" : preview.status;
  return {
    status,
    player: preview.player,
    group: status === "claimed" ? preview.group : null,
    players:
      status === "claimed" || status === "already_yours"
        ? [{ id: 4242, name: rsn.trim() }]
        : [],
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
      flair: "none",
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
      flair: "gold",
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
      flair: "dragon",
      recommended: false,
    },
  ];
}

export function mockSupporters(): Supporters {
  return {
    groups: [
      {
        id: 267,
        name: "DropTracker Test",
        tier_name: "Patron",
        member_count: 7,
        since: 1783434457,
        flair: { tier_key: "t3", tier_name: "Patron", style: "amethyst" },
      },
      {
        id: 190,
        name: "Frontier",
        tier_name: "Sponsor",
        member_count: 456,
        since: 1783169211,
        flair: { tier_key: "t2", tier_name: "Sponsor", style: "gold" },
      },
    ],
    players: [
      { user_id: 645, player_id: 4782, name: "Nycolas Cage", since: 1783516018 },
      { user_id: 746, player_id: 5126, name: "Dizzied", since: 1783516018 },
    ],
  };
}

export function mockPbBosses(groupId?: number): PbBossIndex {
  return {
    group_id: groupId ?? null,
    ...(groupId != null ? { group_name: "Mock Clan" } : {}),
    bosses: [
      {
        npc_id: 13696,
        name: "Chambers of Xeric",
        entry_count: 7130,
        player_count: 1744,
        featured: true,
        team_sizes: ["Solo", "2", "3", "4", "5"],
        best: {
          time_ms: 232000,
          time_display: "3:52.0",
          team_size: "5",
          player_id: 42,
          player_name: "Zezima",
        },
      },
      {
        npc_id: 2042,
        name: "Zulrah",
        entry_count: 1970,
        player_count: 1954,
        featured: false,
        team_sizes: ["Solo"],
        best: {
          time_ms: 44400,
          time_display: "0:44.4",
          team_size: "Solo",
          player_id: 43,
          player_name: "Woox",
        },
      },
    ],
  };
}

export function mockPbBoard(npcId: number, groupId?: number): PbBossBoard {
  const entry = (rank: number, pid: number, name: string, ms: number, display: string) => ({
    rank,
    player_id: pid,
    player_name: name,
    time_ms: ms,
    time_display: display,
    date_ts: 1783434457,
    ...(groupId != null ? { global_rank: rank + 3 } : {}),
  });
  return {
    npc_id: npcId,
    name: "Chambers of Xeric",
    icon_url: `https://www.droptracker.io/img/npcdb/${npcId}.png`,
    entry_count: 7130,
    player_count: 1744,
    group_id: groupId ?? null,
    ...(groupId != null ? { group_name: "Mock Clan" } : {}),
    boards: [
      {
        team_size: "Solo",
        size_label: "Solo",
        total_players: 919,
        entries: [
          entry(1, 42, "Zezima", 557000, "9:17.0"),
          entry(2, 43, "Woox", 561000, "9:21.0"),
          entry(3, 44, "Lynx Titan", 570000, "9:30.0"),
        ],
      },
      {
        team_size: "2",
        size_label: "2 players",
        total_players: 512,
        entries: [entry(1, 45, "B0aty", 495000, "8:15.0")],
      },
    ],
  };
}

export function mockNpcDetail(npcId: number): NpcDetail {
  return {
    npc_id: npcId,
    name: "Vorkath",
    canonical_slug: "vorkath",
    icon_url: `https://www.droptracker.io/img/npcdb/${npcId}.png`,
    wiki_url: "https://oldschool.runescape.wiki/w/Vorkath",
    lifetime: {
      loot: money(17_134_824_514),
      drop_count: 391_830,
      unique_players: 1018,
      last_drop_ts: 1783768488,
    },
    month: {
      partition: 202607,
      loot: money(780_516_575),
      drop_count: 20_425,
      unique_players: 160,
    },
    top_players: NAMES.slice(0, 5).map((name, i) => ({
      rank: i + 1,
      player_id: 1000 + i,
      player_name: name,
      loot: money(500_000_000 / (i + 1)),
      drop_count: Math.floor(40_000 / (i + 1)),
    })),
    recent_drops: NAMES.slice(0, 6).map((name, i) => ({
      drop_id: 9_000_000 - i,
      item_id: i % 2 === 0 ? 22006 : 11286,
      item_name: i % 2 === 0 ? "Skeletal visage" : "Draconic visage",
      icon_url: `https://www.droptracker.io/img/itemdb/${i % 2 === 0 ? 22006 : 11286}.png`,
      player_id: 1000 + i,
      player_name: name,
      value: money(14_000_000),
      quantity: 1,
      ts: 1783768488 - i * 3600,
    })),
  };
}

export function mockNpcDropTable(npcId: number): NpcDropTable {
  const row = (
    itemId: number,
    name: string,
    rarity: number,
    lastName: string | null,
  ): NpcDropTable["items"][number] => ({
    item_id: itemId,
    name,
    icon_url: `https://www.droptracker.io/img/itemdb/${itemId}.png`,
    quantity: "1",
    noted: false,
    rarity,
    rolls: 1,
    last_drop:
      lastName == null
        ? null
        : {
            player_id: 4242,
            player_name: lastName,
            ts: 1783768488,
            value: money(14_000_000),
          },
  });
  return {
    npc_id: npcId,
    name: "Vorkath",
    items: [
      row(11943, "Superior dragon bones", 1, "Zezima"),
      row(22106, "Jar of decay", 1 / 3000, "Woox"),
      row(22006, "Skeletal visage", 1 / 5000, "B0aty"),
      row(21992, "Vorki", 1 / 3000, null),
    ],
    last_drops_status: "ready",
  };
}

export function mockItemDetail(itemId: number): ItemDetail {
  return {
    item_id: itemId,
    name: "Skeletal visage",
    canonical_slug: "skeletal-visage",
    icon_url: `https://www.droptracker.io/img/itemdb/${itemId}.png`,
    wiki_url: "https://oldschool.runescape.wiki/w/Skeletal_visage",
    stackable: false,
    ge_value: money(14_101_200),
    lifetime: {
      loot: money(288_236_091),
      quantity: 20,
      drop_count: 20,
      unique_players: 18,
      last_drop_ts: 1753903651,
    },
    month: {
      partition: 202607,
      loot: money(28_000_000),
      quantity: 2,
      drop_count: 2,
      unique_players: 2,
    },
    top_receivers: NAMES.slice(0, 5).map((name, i) => ({
      rank: i + 1,
      player_id: 1000 + i,
      player_name: name,
      loot: money(43_000_000 / (i + 1)),
      quantity: 3 - Math.min(i, 2),
      drop_count: 3 - Math.min(i, 2),
    })),
    stats_status: "ready",
    recent_drops: NAMES.slice(0, 6).map((name, i) => ({
      drop_id: 9_000_000 - i,
      npc_id: 8060,
      npc_name: "Vorkath",
      npc_icon_url: "https://www.droptracker.io/img/npcdb/8060.png",
      player_id: 1000 + i,
      player_name: name,
      value: money(14_000_000),
      quantity: 1,
      ts: 1783768488 - i * 86400,
    })),
    sources: {
      total: 1,
      npcs: [
        {
          npc_id: 8060,
          name: "Vorkath",
          icon_url: "https://www.droptracker.io/img/npcdb/8060.png",
          quantity: "1",
          rarity: 1 / 5000,
          rolls: 1,
        },
      ],
    },
  };
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

export function mockEventManagers(): EventManagersResponse {
  return {
    managers: [
      { user_id: 3, discord_id: "339175417668501504", username: "mockeventmgr" },
    ],
  };
}

/** Sign-up pool for a `signup_pool` event, enriched with the ability fields the
 * admin sorts on (EHB / total level / monthly loot). Half unassigned, a spread
 * of EHB so sorting/filtering is visible; a couple of `null` EHB rows exercise
 * the "unknown" ("—") rendering. */
export function mockEventSignups(): EventSignup[] {
  const now = Math.floor(Date.now() / 1000);
  const ehbs: (number | null)[] = [1842.5, 934.2, 2610, null, 512.8, 88.4, 1420, 305.1, null, 61.7];
  const levels = [2277, 2201, 2154, 1983, 2050, 1621, 2277, 1875, 1402, 1290];
  const loot = [
    412_000_000, 88_500_000, 1_240_000_000, 0, 26_400_000, 4_100_000, 305_000_000,
    12_900_000, 0, 780_000,
  ];
  return NAMES.map((name, i) => ({
    player_id: 1000 + i,
    player_name: name,
    group_id: i % 3 === 0 ? 2 : 1,
    group_name: i % 3 === 0 ? "Rivals" : "Mock Clan",
    team_id: i % 2 === 0 ? null : (i % 4 === 1 ? 101 : 102),
    source: i % 4 === 0 ? ("discord" as const) : ("web" as const),
    signed_up_at: now - i * 3600,
    ehb: ehbs[i] ?? null,
    total_level: levels[i] ?? null,
    monthly_loot: money(loot[i] ?? 0),
  }));
}

export function mockGroupSubscription(groupId: number): GroupSubscription {
  const renews = Math.floor(Date.now() / 1000) + 18 * 86400;
  // Pool model: a legacy PayPal base leg + a member's Stripe difference leg
  // together cover Premium+ ($15/mo).
  return {
    group_id: groupId,
    tier_key: "premium_plus",
    status: "active",
    provider: null,
    current_period_end: renews,
    cancel_at_period_end: false,
    total_monthly_cents: 1500,
    legs: [
      {
        id: 1,
        user_id: null,
        user_name: null,
        tier_key: "premium",
        amount_cents: 500,
        provider: "paypal",
        status: "active",
        current_period_end: renews,
        cancel_at_period_end: false,
        mine: false,
      },
      {
        id: 2,
        user_id: 1,
        user_name: "MockUser",
        tier_key: "premium_plus",
        amount_cents: 1000,
        provider: "stripe",
        status: "active",
        current_period_end: renews + 5 * 86400,
        cancel_at_period_end: false,
        mine: true,
      },
    ],
    entitlements: {
      events: true,
      events_max_active: 3,
      hall_of_fame: true,
      custom_embeds: true,
      video_submissions: true,
      custom_points: true,
    },
  };
}

export function mockGroupSubscriptionSummary(groupId: number): GroupSubscriptionSummary {
  return {
    group_id: groupId,
    tier_key: "premium",
    tier_name: "Premium",
    total_monthly_cents: 500,
    next_tier: { key: "premium_plus", name: "Premium+", price_cents: 1500, delta_cents: 1000 },
  };
}

export function mockAdminSubscriptionsOverview(): AdminSubscriptionsOverview {
  const now = Math.floor(Date.now() / 1000);
  const month = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return {
    kpis: {
      mrr_cents: 6500,
      group_mrr_cents: 5500,
      user_mrr_cents: 1000,
      paying_groups: 4,
      active_user_subscriptions: 2,
      past_due: 1,
      lifetime_cents: 84500,
    },
    tier_distribution: [
      { tier_key: "premium", tier_name: "Premium", groups: 3 },
      { tier_key: "premium_plus", tier_name: "Premium+", groups: 1 },
    ],
    income_by_month: Array.from({ length: 12 }, (_, i) => ({
      month: month(11 - i),
      amount_cents: 4500 + ((i * 733) % 3000),
    })),
    subscriptions: [
      {
        scope: "group",
        id: 1,
        group_id: 101,
        group_name: "Clan 1",
        user_id: null,
        user_name: null,
        tier_key: "premium",
        amount_cents: 500,
        provider: "paypal",
        status: "active",
        live: true,
        current_period_end: now + 12 * 86400,
        cancel_at_period_end: false,
      },
      {
        scope: "group",
        id: 2,
        group_id: 101,
        group_name: "Clan 1",
        user_id: 1,
        user_name: "MockUser",
        tier_key: "premium_plus",
        amount_cents: 1000,
        provider: "stripe",
        status: "active",
        live: true,
        current_period_end: now + 20 * 86400,
        cancel_at_period_end: false,
      },
      {
        scope: "user",
        id: 5,
        group_id: null,
        group_name: null,
        user_id: 1098,
        user_name: "wimi.",
        tier_key: "supporter",
        amount_cents: 1000,
        provider: "stripe",
        status: "active",
        live: true,
        current_period_end: now + 28 * 86400,
        cancel_at_period_end: false,
      },
      {
        scope: "group",
        id: 3,
        group_id: 102,
        group_name: "Clan 2",
        user_id: null,
        user_name: null,
        tier_key: "premium",
        amount_cents: 500,
        provider: "paypal",
        status: "expired",
        live: false,
        current_period_end: now - 40 * 86400,
        cancel_at_period_end: true,
      },
    ],
    recent_payments: [
      {
        id: 3,
        scope: "user",
        group_id: null,
        group_name: null,
        user_id: 1098,
        user_name: "wimi.",
        tier_key: "supporter",
        provider: "stripe",
        amount_cents: 1000,
        currency: "USD",
        kind: "payment",
        paid_at: now - 3600,
      },
      {
        id: 2,
        scope: "group",
        group_id: 101,
        group_name: "Clan 1",
        user_id: 1,
        user_name: "MockUser",
        tier_key: "premium_plus",
        provider: "stripe",
        amount_cents: 1000,
        currency: "USD",
        kind: "payment",
        paid_at: now - 86400,
      },
      {
        id: 1,
        scope: "group",
        group_id: 101,
        group_name: "Clan 1",
        user_id: null,
        user_name: null,
        tier_key: "premium",
        provider: "paypal",
        amount_cents: 500,
        currency: "USD",
        kind: "payment",
        paid_at: now - 3 * 86400,
      },
    ],
    generated_at: now,
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

const MOCK_LAYOUT_TYPES = ["event_started", "event_ended", "event_completion"] as const;

function mockLayoutBlocks(messageType: string): EventMessageLayout {
  return {
    message_type: messageType,
    accent_color: "#FFD700",
    blocks: [
      { type: "text", content: `## 🏁 {event_name} — ${messageType.replace(/_/g, " ")}` },
      { type: "separator" },
      { type: "text", content: "{description}" },
      {
        type: "buttons",
        buttons: [{ label: "View event", url: "{event_url}" }],
      },
    ],
  };
}

export function mockEventLayoutMeta(): EventLayoutMeta {
  return {
    types: MOCK_LAYOUT_TYPES.map((key) => ({
      key,
      label: key.replace(/^event_/, "").replace(/_/g, " "),
      group: "Lifecycle",
      description: "Mock event message type.",
      supports_standings: key === "event_ended",
      tokens: [
        { token: "event_name", help: "The event's name", sample: "Summer Loot Sweep" },
        { token: "event_url", help: "Event page URL", sample: "https://www.droptracker.io/events/42" },
        { token: "description", help: "Event description", sample: "Six weeks of loot." },
      ],
    })),
    limits: { max_blocks: 15, max_text_len: 2000, max_buttons: 5 },
    sample_standings: [
      { name: "Team Bandos", score: 120 },
      { name: "Team Zamorak", score: 95 },
    ],
    schema_version: 1,
  };
}

export function mockGroupEventLayouts(): GroupEventLayoutsResponse {
  return {
    layouts: MOCK_LAYOUT_TYPES.map((message_type) => ({
      message_type,
      custom: message_type === "event_started" ? mockLayoutBlocks(message_type) : null,
      default: mockLayoutBlocks(message_type),
    })),
  };
}

export function mockEventLayouts(): EventLayoutsResponse {
  return {
    layouts: MOCK_LAYOUT_TYPES.map((message_type) => ({
      message_type,
      override: null,
      effective: mockLayoutBlocks(message_type),
    })),
  };
}

export function mockServices(): ServiceStatus[] {
  const now = Math.floor(Date.now() / 1000);
  // Mirrors the backend SERVICE_REGISTRY (web_api/routes/admin.py): every app
  // unit grouped by tier, plus read-only infrastructure rows.
  const svc = (
    unit: string,
    name: string,
    category: string,
    description: string,
    over: Partial<ServiceStatus> = {},
  ): ServiceStatus => ({
    unit,
    name,
    status: "running",
    active: true,
    since: now - 86400 * 3,
    description,
    category,
    kind: "service",
    port: null,
    sub_state: "running",
    memory_mb: 180,
    n_restarts: 0,
    enabled: true,
    last_result: "success",
    actions: ["start", "stop", "restart"],
    confirm_stop: false,
    confirm_restart: false,
    ...over,
  });
  return [
    svc("droptracker-api", "RuneLite intake API", "Web & APIs", "Receives plugin submissions", {
      port: 31323,
      confirm_stop: true,
    }),
    svc("droptracker-webapi", "Web API (this backend)", "Web & APIs", "Serves /api/v1 for the website", {
      port: 31325,
      confirm_stop: true,
    }),
    svc("droptracker-node", "Website deploy (blue-green)", "Web & APIs", "Restart = zero-downtime deploy (~2 min)", {
      kind: "deploy",
      sub_state: "exited",
      memory_mb: null,
      actions: ["restart"],
    }),
    svc("droptracker-node-blue", "Website front-end — blue", "Web & APIs", "Next.js instance; one colour serves live traffic", {
      kind: "web",
      port: 31380,
      actions: ["restart"],
      confirm_stop: true,
      confirm_restart: true,
    }),
    svc("droptracker-node-green", "Website front-end — green", "Web & APIs", "Next.js instance; one colour serves live traffic", {
      kind: "web",
      port: 31381,
      actions: ["restart"],
      confirm_stop: true,
      confirm_restart: true,
    }),
    svc("droptracker-core", "Discord bot (core)", "Discord bots", "Slash commands, notifications, lootboard posting"),
    svc("droptracker-webhooks", "Webhook reader bot", "Discord bots", "Reads webhook-channel messages", {
      since: now - 3600,
      n_restarts: 2,
    }),
    svc("droptracker-heartbeat", "Heartbeat bot", "Discord bots", "Uptime heartbeat"),
    svc("droptracker-hof", "Hall of Fame bot", "Discord bots", "Generates and posts Hall of Fame images"),
    svc("droptracker-webhook-consumer", "Intake queue consumer", "Processing & workers", "Drains webhook:queue", {
      confirm_stop: true,
    }),
    svc("droptracker-events", "Events consumer", "Processing & workers", "Applies submissions to active events"),
    svc("droptracker-lootboards", "Lootboard generator", "Processing & workers", "Regenerates lootboard images", {
      status: "failed",
      active: false,
      sub_state: "failed",
      memory_mb: null,
      last_result: "exit-code",
    }),
    svc("droptracker-player-updates", "Player updater", "Processing & workers", "WOM sync + leaderboards"),
    svc("droptracker-video-worker", "Video worker", "Processing & workers", "MJPEG→MP4 conversion + B2 upload"),
    svc("nginx", "nginx", "Infrastructure", "Reverse proxy fronting every HTTP service", {
      kind: "infra",
      port: 80,
      actions: [],
    }),
    svc("mariadb", "MariaDB", "Infrastructure", "Primary database", {
      kind: "infra",
      port: 3306,
      actions: [],
    }),
    svc("redis-server", "Redis", "Infrastructure", "Leaderboards, queues, realtime pub/sub", {
      kind: "infra",
      port: 6379,
      actions: [],
    }),
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

export function mockBackupOverview(): BackupOverview {
  const now = Math.floor(Date.now() / 1000);
  const day = (offset: number) =>
    new Date((now - offset * 86400) * 1000).toISOString().slice(0, 10);
  const files = (date: string) => [
    { name: `data-${date}.sql.gz`, size: 3_150_000_000, modified: now - 3600 },
    { name: `data-schema-${date}.sql.gz`, size: 12_500, modified: now - 3500 },
    { name: `xenforo-${date}.sql.gz`, size: 223_000_000, modified: now - 3400 },
    { name: `redis-${date}.rdb.gz`, size: 400_000_000, modified: now - 3300 },
  ];
  return {
    unit: "droptracker-db-backup",
    running: false,
    timer: { enabled: true, active: true, next_run: now + 43200, last_trigger: now - 43200 },
    last_run: {
      started: now - 44400,
      finished: now - 43200,
      duration_seconds: 1200,
      success: true,
      result: "success",
      exit_status: 0,
    },
    sets: [0, 1, 2].map((i) => ({
      date: day(i),
      status: "complete" as const,
      total_bytes: 3_773_012_500,
      files: files(day(i)),
    })),
    disk: { free_bytes: 76_000_000_000, total_bytes: 440_000_000_000 },
    retention: { local_days: 7, remote_days: 30 },
  };
}

export function mockBackupOffsite(): BackupOffsite {
  const overview = mockBackupOverview();
  return {
    bucket: "droptracker-videos",
    prefix: "dt_backups/",
    total_bytes: overview.sets.reduce((sum, s) => sum + s.total_bytes, 0),
    days: overview.sets.map((s) => ({
      date: s.date,
      objects: s.files.length,
      total_bytes: s.total_bytes,
      files: s.files,
    })),
  };
}

export function mockB2Usage(): B2Usage {
  const now = Math.floor(Date.now() / 1000);
  return {
    bucket: "droptracker-video",
    generated_at: now,
    objects: 213,
    total_bytes: 7_806_710_062,
    prefixes: [
      { prefix: "dt_backups", objects: 8, total_bytes: 7_552_805_071 },
      { prefix: "dt_videos", objects: 205, total_bytes: 253_904_991 },
    ],
    largest: [
      { key: "dt_backups/mysql/2026-07-13/data-2026-07-13.sql.gz", size: 3_154_800_806, modified: now - 3600 },
      { key: "dt_backups/mysql/2026-07-12/data-2026-07-12.sql.gz", size: 3_145_368_292, modified: now - 90000 },
      { key: "dt_backups/mysql/2026-07-13/redis-2026-07-13.rdb.gz", size: 409_077_275, modified: now - 3500 },
    ],
    estimate: {
      storage_rate_usd_per_gb_month: 0.006,
      free_storage_bytes: 10_000_000_000,
      storage_usd_per_month: 0,
      free_egress_bytes_per_month: 23_420_130_186,
    },
  };
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

  const PLAYERS = [
    "Zezima",
    "B0aty",
    "Woox",
    "Framed",
    "SkillSpecs",
    "Odablock",
    "Torvesta",
    "Faux",
    "Settled",
    "Mr Mammal",
    "A Friend",
    "Solomission",
  ];

  const nowMs = Date.now();
  const stamp = (minsAgo: number) =>
    new Date(nowMs - minsAgo * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");

  const items = ITEMS.map(([item_id, name, unit], i) => {
    const quantity = 1 + ((i * 7) % 11);
    const total = unit * quantity;
    // Per-player tooltip breakdown: split the stack across a few recipients.
    const recipients = 1 + ((i * 3) % 3);
    let remainingQty = quantity;
    let remainingVal = total;
    const contributors = Array.from({ length: recipients }, (_, j) => {
      const last = j === recipients - 1;
      const q = last ? remainingQty : Math.max(1, Math.floor(quantity / recipients));
      const v = last ? remainingVal : Math.floor(total / recipients);
      remainingQty -= q;
      remainingVal -= v;
      return {
        player_id: 1000 + ((i + j) % PLAYERS.length),
        player_name: PLAYERS[(i + j) % PLAYERS.length] ?? "Unknown",
        quantity: q,
        value: money(v),
        last_at: stamp(30 + i * 90 + j * 45),
      };
    });
    return {
      item_id,
      name,
      quantity,
      value: money(total),
      icon_url: icon(item_id),
      is_coin: false,
      contributors,
      contributor_count: recipients,
    };
  });
  const total = items.reduce((s, it) => s + it.value.value, 0);
  const leaderboard = PLAYERS.map((player_name, i) => ({
    rank: i + 1,
    player_id: 1000 + i,
    player_name,
    total: money(Math.round(total / (i + 2))),
  }));

  const recent_drops = items.slice(0, 12).map((it, i) => ({
    item_id: it.item_id,
    name: it.name,
    icon_url: it.icon_url,
    player_id: 1000 + (i % PLAYERS.length),
    player_name: PLAYERS[i % PLAYERS.length] ?? "Unknown",
    quantity: 1,
    value: money(it.value.value),
    date_added: stamp(i * 47),
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
    mode: "standard" as const,
    visibility: "public" as const,
    formation_mode: "self_join" as const,
    requires_confirmation: false,
    submission_policy: "all" as const,
    board_size: 5,
    bonus_line_points: 10,
    bonus_blackout_points: 100,
    leadership: { enabled: false, co_leaders: false, selection: "admin" as const },
    per_group_discord: false,
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
      kind: "bingo" as const,
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
      kind: "standard" as const,
      activated_at: now - 40 * DAY,
      ended_at: now - 26 * DAY,
      ...eventDefaults,
    },
    {
      id: 3,
      group_id: groupId ?? 101,
      name: "GWD Loot Sweep",
      description: "Race to sweep the God Wars and Barrows collection logs.",
      status: "active",
      starts_at: now - 5 * DAY,
      ends_at: now + 9 * DAY,
      has_bingo: false,
      kind: "loot_sweep" as const,
      activated_at: now - 5 * DAY,
      ...eventDefaults,
    },
    {
      id: 4,
      group_id: groupId ?? 101,
      name: "Loot Sweep Duos",
      description: "A small-field sweep — three duos racing the same logs.",
      status: "active",
      starts_at: now - 2 * DAY,
      ends_at: now + 12 * DAY,
      has_bingo: false,
      kind: "loot_sweep" as const,
      activated_at: now - 2 * DAY,
      ...eventDefaults,
    },
  ];
  return all.filter((e) => (status ? e.status === status : true));
}

export function mockEvent(id: number): EventDetail {
  const now = Math.floor(Date.now() / 1000);
  const summary = mockEvents().find((e) => e.id === id) ?? mockEvents()[0]!;
  if (summary.kind === "loot_sweep") {
    const board = mockEventLootSweep(id);
    return {
      ...summary,
      id,
      tasks: [],
      teams: board.teams.map((t) => ({
        id: t.id,
        name: t.name,
        score: t.score,
        coins: 0,
        ...(t.color ? { color: t.color } : {}),
        member_count: 2,
        members: [],
      })),
      progress: [],
      bingo: null,
      viewer: { player_ids_on_event: [1337], team_id: 31, signed_up_player_ids: [] },
      join_requires_code: false,
      join_code: null,
      starts_at: summary.starts_at ?? now,
      ends_at: summary.ends_at ?? now + 7 * DAY,
    };
  }
  const cells = Array.from({ length: 25 }, (_, i) => ({
    index: i,
    label: ["Twisted bow", "Free space", "99 Slayer", "Vorkath 50kc", "Any 2 hilts"][i % 5]!,
    task_id: [12, null, 13, 11, 15][i % 5] ?? null,
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
          ? [
              {
                team_id: 22,
                team_name: "Team Blue",
                player_id: 2003,
                player_name: "Framed",
                completed_at: now - 7200,
              },
            ]
          : [],
  }));
  return {
    ...summary,
    id,
    tasks: [
      {
        id: 11,
        type: "kc_target",
        label: "Vorkath 50 KC",
        target: "Vorkath",
        target_value: 50,
        points: 10,
        requires_confirmation: false,
        visibility: "public",
        tile: {
          badge: "KC TARGET",
          value: "50 KC",
          icons: [{ type: "npc", id: 8060, name: "Vorkath" }],
          icon_overflow: 0,
        },
      },
      {
        id: 12,
        type: "item_collection",
        label: "Obtain a Twisted bow",
        target: "Twisted bow",
        points: 50,
        requires_confirmation: true,
        visibility: "private",
        tile: {
          badge: "COLLECT",
          value: null,
          icons: [{ type: "item", id: 20997, name: "Twisted bow" }],
          icon_overflow: 0,
        },
      },
      {
        id: 13,
        type: "skill_target",
        label: "Reach 99 Slayer",
        target: "Slayer",
        target_value: 99,
        points: 25,
        requires_confirmation: false,
        visibility: "public",
        tile: {
          badge: "SKILL LEVEL",
          value: "Lvl 99",
          icons: [{ type: "skill", id: null, name: "slayer" }],
          icon_overflow: 0,
        },
      },
      {
        id: 14,
        type: "xp_target",
        label: "Gain 10M Ranged XP",
        target: "Ranged",
        target_value: 10_000_000,
        points: 15,
        requires_confirmation: false,
        visibility: "public",
        tile: {
          badge: "XP TARGET",
          value: "10.00M XP",
          icons: [{ type: "skill", id: null, name: "ranged" }],
          icon_overflow: 0,
        },
      },
      {
        id: 15,
        type: "item_collection",
        label: "Collect any 2 godsword hilts",
        target: null,
        target_value: 2,
        points: 30,
        requires_confirmation: false,
        visibility: "public",
        config: JSON.stringify({
          kind: "any_of",
          items: ["Bandos hilt", "Armadyl hilt", "Zamorak hilt", "Saradomin hilt"],
        }),
        tile: {
          badge: "ANY 2",
          value: null,
          icons: [
            { type: "item", id: 11812, name: "Bandos hilt" },
            { type: "item", id: 11810, name: "Armadyl hilt" },
            { type: "item", id: 11816, name: "Zamorak hilt" },
            { type: "item", id: 11814, name: "Saradomin hilt" },
          ],
          icon_overflow: 0,
        },
      },
    ],
    teams: [
      {
        id: 21,
        name: "Team Red",
        score: 120,
        coins: 0,
        color: "#e05c4c",
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
        coins: 0,
        color: "#38bdf8", // custom (not in the default palette)
        member_count: 2,
        members: [
          { player_id: 2003, player_name: "Framed", joined_at: now - 3 * DAY },
          { player_id: 2004, player_name: "Settled", joined_at: now - DAY },
        ],
      },
      { id: 23, name: "Team Green", score: 60, coins: 0, member_count: 0, members: [] },
    ],
    progress: [
      { task_id: 11, team_id: 21, progress: 35, completed: false, completed_at: null },
      { task_id: 11, team_id: 22, progress: 50, completed: true, completed_at: now - 5400 },
      { task_id: 12, team_id: 21, progress: 1, completed: true, completed_at: now - 3600 },
      { task_id: 14, team_id: 22, progress: 4_250_000, completed: false, completed_at: null },
      { task_id: 15, team_id: 21, progress: 1, completed: false, completed_at: null },
      { task_id: 15, team_id: 22, progress: 2, completed: true, completed_at: now - 900 },
    ],
    bingo: summary.has_bingo ? { size: 5, cells } : null,
    viewer: { player_ids_on_event: [1337], team_id: 21, signed_up_player_ids: [] },
    join_requires_code: false,
    join_code: null,
    starts_at: summary.starts_at ?? now,
    ends_at: summary.ends_at ?? now + 7 * DAY,
  };
}

/** Loot Sweep mock roster: 8 teams so the matrix exercises ranking, the
 * pinned viewer column (team 31), palette fallbacks, and quiet tail teams.
 * `intensity` drives how far along each team's collection is (1 = leader). */
const LOOT_SWEEP_TEAMS: { id: number; name: string; color: string | null; intensity: number }[] = [
  { id: 31, name: "Whiteclaw", color: "#8db255", intensity: 0.8 },
  { id: 32, name: "Ironveil", color: "#d4537e", intensity: 1 },
  { id: 33, name: "Duskfall", color: null, intensity: 0.9 },
  { id: 34, name: "Emberkin", color: null, intensity: 0.65 },
  { id: 35, name: "Tidecall", color: null, intensity: 0.5 },
  { id: 36, name: "Stonewrit", color: null, intensity: 0.35 },
  { id: 37, name: "Ashenvow", color: null, intensity: 0.15 },
  { id: 38, name: "Palefang", color: null, intensity: 0 },
];

const LS_DECAY = 20;

function lsItem(
  item_name: string,
  item_id: number | null,
  points: number,
  extra: Partial<LootSweepGroup["items"][number]> = {},
): LootSweepGroup["items"][number] {
  // The board endpoint resolves icon_ids in prod; mirror it here so the mock
  // exercises the icon cluster (primary first unless virtual).
  const icon_ids = extra.icon_ids ?? (item_id != null && !extra.virtual ? [item_id] : []);
  return { item_name, item_id, points, icon_ids, ...extra };
}

/** Deterministic per-team progress for one set: `intensity` scales receipt
 * counts (with a small per-item wobble so columns don't look uniform), and
 * bonus/pet items only land for the two leading teams. Totals reuse the real
 * decay math so tooltips and sums match what the engine would award. */
function lsTeamEntry(
  teamId: number,
  intensity: number,
  set: Pick<LootSweepSet, "groups" | "set_bonus_points" | "set_bonus_max">,
): LootSweepSet["teams"][number] {
  const groups = set.groups.map((g, gi) => {
    let itemTotalSum = 0;
    let gatingComplete = true;
    const items = g.items.map((it, ii) => {
      const max = it.max_awards ?? defaultMaxAwards(it.awards_per_tier ?? 1);
      const gates = it.counts_for_group !== false;
      const wobble = (ii + gi + teamId) % 3;
      let count = Math.max(0, Math.round(intensity * max) - wobble);
      if (!gates) count = intensity >= 0.9 ? 1 : 0;
      count = Math.min(count, max);
      const scored = count;
      const points = itemTotal(it.points, count, max, LS_DECAY, it.awards_per_tier ?? 1, "linear");
      itemTotalSum = Math.round((itemTotalSum + points) * 100) / 100;
      if (gates && count < (it.required ?? 1)) gatingComplete = false;
      return { count, scored, points };
    });
    const awarded = gatingComplete ? Math.min(1, g.bonus_max) : 0;
    return {
      completions: awarded,
      awarded,
      bonus_total: awarded * g.bonus_points,
      item_total: itemTotalSum,
      items,
    };
  });
  const allDone = groups.every((g) => g.awarded > 0);
  const set_awarded = allDone ? Math.min(1, set.set_bonus_max) : 0;
  const set_total = set_awarded * set.set_bonus_points;
  return {
    team_id: teamId,
    total: groups.reduce((s, g) => s + g.item_total + g.bonus_total, 0) + set_total,
    set_completions: set_awarded,
    set_awarded,
    set_total,
    groups,
  };
}

function lsSet(
  roster: typeof LOOT_SWEEP_TEAMS,
  task_id: number,
  label: string,
  cfg: {
    set_bonus_points?: number;
    set_bonus_max?: number;
    groups: LootSweepGroup[];
  },
): LootSweepSet {
  const base = {
    task_id,
    label,
    decay_percent: LS_DECAY,
    decay_mode: "linear" as const,
    set_bonus_points: cfg.set_bonus_points ?? 0,
    set_bonus_max: cfg.set_bonus_max ?? 1,
    groups: cfg.groups,
  };
  return {
    ...base,
    teams: roster.map((t) => lsTeamEntry(t.id, t.intensity, base)),
  };
}

/** Loot Sweep live board (GET /events/{id}/loot-sweep): three sets covering
 * the matrix's shapes — a plain boss, high-cap batched items (progress bars),
 * and a multi-group meta-set. Event 4 runs a 3-team field so dev exercises
 * the ≤4-team icon-tab mode. */
export function mockEventLootSweep(eventId: number): LootSweepBoard {
  const roster = eventId === 4 ? LOOT_SWEEP_TEAMS.slice(0, 3) : LOOT_SWEEP_TEAMS;
  const sets: LootSweepSet[] = [
    lsSet(roster, 41, "Kree'arra", {
      groups: [
        {
          npcs: ["Kree'arra"],
          npc_id: 3162,
          bonus_points: 40,
          bonus_max: 1,
          items: [
            lsItem("Armadyl helmet", 11826, 9),
            lsItem("Armadyl chestplate", 11828, 9),
            lsItem("Armadyl chainskirt", 11830, 9),
            lsItem("Armadyl hilt", 11810, 13),
            lsItem("Pet kree'arra", null, 60, { counts_for_group: false, source: "pet" }),
          ],
        },
      ],
    }),
    lsSet(roster, 42, "K'ril Tsutsaroth", {
      groups: [
        {
          npcs: ["K'ril Tsutsaroth"],
          npc_id: 3129,
          bonus_points: 35,
          bonus_max: 1,
          items: [
            lsItem("Steam battlestaff", 11787, 2, { awards_per_tier: 2 }),
            lsItem("Zamorakian spear", 11824, 2, {
              awards_per_tier: 2,
              match_names: ["Zamorakian hasta"],
            }),
            lsItem("Staff of the dead", 11791, 7),
            lsItem("Zamorak hilt", 11816, 7),
          ],
        },
      ],
    }),
    lsSet(roster, 43, "Barrows Brothers", {
      set_bonus_points: 40,
      set_bonus_max: 1,
      groups: [
        {
          label: "Ahrim",
          npcs: ["Ahrim the Blighted"],
          npc_id: 1672,
          bonus_points: 4,
          bonus_max: 1,
          items: [
            lsItem("Ahrim's hood", 4708, 2, { required: 2 }),
            lsItem("Ahrim's robetop", 4712, 2),
            lsItem("Ahrim's robeskirt", 4714, 2),
            lsItem("Ahrim's staff", 4710, 2),
          ],
        },
        {
          label: "Dharok",
          npcs: ["Dharok the Wretched"],
          npc_id: 1673,
          bonus_points: 4,
          bonus_max: 1,
          items: [
            lsItem("Dharok's helm", 4716, 2),
            lsItem("Dharok's platebody", 4720, 2),
            lsItem("Dharok's platelegs", 4722, 2),
            lsItem("Dharok's greataxe", 4718, 2),
          ],
        },
      ],
    }),
    lsSet(roster, 44, "Chambers of Xeric", {
      set_bonus_points: 30,
      set_bonus_max: 1,
      groups: [
        {
          npcs: ["Great Olm"],
          npc_id: 7551,
          bonus_points: 25,
          bonus_max: 3,
          items: [
            // A virtual, pooled entry: any 3 ancestral pieces complete the slot.
            lsItem("Any ancestral piece", null, 3, {
              virtual: true,
              required: 3,
              match_names: ["Ancestral hat", "Ancestral robe top", "Ancestral robe bottom"],
              icon_ids: [21018, 21021, 21024],
            }),
            lsItem("Dragon claws", 13652, 6),
            lsItem("Twisted bow", 20997, 40, { max_awards: 3 }),
            lsItem("Olmlet", null, 45, { counts_for_group: false, source: "pet" }),
          ],
        },
      ],
    }),
  ];
  const totals = new Map<number, number>();
  for (const s of sets) {
    for (const t of s.teams) totals.set(t.team_id, (totals.get(t.team_id) ?? 0) + t.total);
  }
  return {
    event_id: eventId,
    kind: "loot_sweep",
    teams: roster.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      score: totals.get(t.id) ?? 0,
    })),
    sets,
  };
}

const LS_MOCK_PLAYERS = ["Zezima", "Woox", "B0aty", "Framed", "Settled", "Sick Nerd"];

/** Receipt ledger for one item (the hover card): fabricated from the same
 * counts the board mock reports, with the exact per-receipt decay points so
 * card totals always match the cell. Every third receipt carries a fake
 * proof screenshot to exercise the thumbnail. */
export function mockEventLootSweepReceipts(
  eventId: number,
  taskId: number,
  item: string,
): LootSweepReceipts {
  const now = Math.floor(Date.now() / 1000);
  const board = mockEventLootSweep(eventId);
  const set = board.sets.find((s) => s.task_id === taskId) ?? board.sets[0]!;
  const wanted = item.trim().toLowerCase();
  let groupIdx = 0;
  let itemIdx = 0;
  let def = set.groups[0]!.items[0]!;
  set.groups.forEach((g, gi) =>
    g.items.forEach((it, ii) => {
      if (it.item_name.toLowerCase() === wanted) {
        groupIdx = gi;
        itemIdx = ii;
        def = it;
      }
    }),
  );
  const max = def.max_awards ?? defaultMaxAwards(def.awards_per_tier ?? 1);
  // A pooled entry's receipts cycle through its real piece names.
  const pieceNames = def.match_names?.length ? def.match_names : [def.item_name];
  return {
    event_id: eventId,
    task_id: set.task_id,
    item_name: def.item_name,
    item_id: def.item_id ?? null,
    virtual: def.virtual,
    required: def.required,
    match_names: def.match_names,
    icon_ids: def.icon_ids,
    teams: set.teams.map((t, ti) => {
      const count = t.groups[groupIdx]?.items[itemIdx]?.count ?? 0;
      return {
        team_id: t.team_id,
        receipts: Array.from({ length: count }, (_, k) => ({
          n: k + 1,
          quantity: 1,
          player_id: 1000 + ti * 10 + k,
          player_name: LS_MOCK_PLAYERS[(ti + k) % LS_MOCK_PLAYERS.length]!,
          received_at: now - (count - k) * 5400 * (ti + 1),
          points:
            itemTotal(def.points, k + 1, max, LS_DECAY, def.awards_per_tier ?? 1, "linear") -
            itemTotal(def.points, k, max, LS_DECAY, def.awards_per_tier ?? 1, "linear"),
          matched_name: pieceNames[k % pieceNames.length],
          proof_url: k % 3 === 0 ? "/img/npcdb/3162.png" : null,
          source_type: def.source === "pet" ? "pet" : "drop",
        })),
      };
    }),
  };
}

/** Public team page payload (standings context + roster + progress + feed). */
export function mockEventTeam(eventId: number, teamId: number): EventTeamDetail {
  const now = Math.floor(Date.now() / 1000);
  const event = mockEvent(eventId);
  const team = event.teams.find((t) => t.id === teamId) ?? event.teams[0]!;
  const rank =
    [...event.teams].sort((a, b) => b.score - a.score).findIndex((t) => t.id === team.id) + 1;
  return {
    event: mockEvents().find((e) => e.id === eventId) ?? mockEvents()[0]!,
    team: {
      id: team.id,
      name: team.name,
      score: team.score,
      rank,
      team_count: event.teams.length,
      member_count: team.member_count,
      coins: 0,
      loot_gp: money(312_500_000),
    },
    members: (team.members ?? []).map((m, i) => ({
      ...m,
      completions: 3 - (i % 3),
      quantity: 40 - i * 12,
      points: [7.5, 2.33, 0][i % 3]!,
      loot_gp: money([120_000_000, 88_400_000, 12_000_000][i % 3]!),
    })),
    items: [
      { name: "Twisted bow", item_id: 20997, quantity: 1, drops: 1 },
      { name: "Dragon claws", item_id: 13652, quantity: 3, drops: 2 },
      { name: "Bandos chestplate", item_id: 11832, quantity: 1, drops: 1 },
    ],
    tasks: event.tasks.map((t, i) => ({
      ...t,
      progress: [35, 1, 0, 4_250_000][i] ?? 0,
      completed: i === 1,
      completed_at: i === 1 ? now - 3600 : null,
    })),
    activity: [
      {
        id: 901,
        task_id: 11,
        task_label: "Vorkath 50 KC",
        player_id: 1337,
        player_name: "Zezima",
        quantity: 1,
        source_type: "kc",
        created_at: now - 900,
      },
      {
        id: 900,
        task_id: 12,
        task_label: "Obtain a Twisted bow",
        player_id: 2001,
        player_name: "Woox",
        quantity: 1,
        source_type: "drop",
        created_at: now - 3600,
      },
      {
        id: 899,
        task_id: 11,
        task_label: "Vorkath 50 KC",
        player_id: 2002,
        player_name: "B0aty",
        quantity: 1,
        source_type: "kc",
        created_at: now - 5400,
      },
    ],
  };
}

/** Event-wide player contribution leaderboard (Players tab). */
export function mockEventPlayers(eventId: number): EventPlayersResponse {
  const event = mockEvents().find((e) => e.id === eventId) ?? mockEvents()[0]!;
  const players: EventPlayerRow[] = [
    {
      player_id: 2001,
      player_name: "Woox",
      team_id: 1,
      team_name: "Team Alpha",
      team_color: "#c0392b",
      role: "leader",
      points: 42.5,
      completions: 8,
      quantity: 190,
      tasks_contributed: 5,
      loot_gp: money(184_000_000),
      items: [
        { name: "Twisted bow", item_id: 20997, quantity: 1, drops: 1 },
        { name: "Dragon claws", item_id: 13652, quantity: 3, drops: 2 },
      ],
    },
    {
      player_id: 1337,
      player_name: "Zezima",
      team_id: 1,
      team_name: "Team Alpha",
      team_color: "#c0392b",
      role: null,
      points: 21,
      completions: 5,
      quantity: 88,
      tasks_contributed: 3,
      loot_gp: money(96_500_000),
      items: [{ name: "Bandos chestplate", item_id: 11832, quantity: 1, drops: 1 }],
    },
    {
      player_id: 2002,
      player_name: "B0aty",
      team_id: 2,
      team_name: "Team Bravo",
      team_color: "#2980b9",
      role: "leader",
      points: 12.33,
      completions: 3,
      quantity: 40,
      tasks_contributed: 2,
      loot_gp: money(41_200_000),
      items: [],
    },
  ];
  return {
    event,
    players,
    totals: {
      contributors: players.length,
      participants: 6,
      completions: 16,
      points: 75.83,
      tasks: 4,
      loot_gp: money(321_700_000),
    },
  };
}

/** Teams-tab standings rollup (GET /events/{id}/teams). */
export function mockEventTeams(eventId: number): EventTeamsResponse {
  const event = mockEvents().find((e) => e.id === eventId) ?? mockEvents()[0]!;
  const detail = mockEvent(eventId);
  const ranked = [...detail.teams].sort((a, b) => b.score - a.score);
  const itemSets: EventPlayerItem[][] = [
    [
      { name: "Twisted bow", item_id: 20997, quantity: 1, drops: 1 },
      { name: "Dragon claws", item_id: 13652, quantity: 3, drops: 2 },
    ],
    [{ name: "Bandos chestplate", item_id: 11832, quantity: 1, drops: 1 }],
  ];
  const contributors = [
    [
      { player_id: 2001, player_name: "Woox", points: 42.5 },
      { player_id: 1337, player_name: "Zezima", points: 21 },
    ],
    [{ player_id: 2002, player_name: "B0aty", points: 12.33 }],
  ];
  return {
    event,
    teams: ranked.map((t, i) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      rank: i + 1,
      group_id: t.group_id ?? null,
      color: t.color ?? null,
      coins: t.coins ?? 0,
      piece_item_id: t.piece_item_id ?? null,
      member_count: t.member_count,
      tasks_done: [3, 1][i] ?? 0,
      loot_gp: money([312_500_000, 41_200_000][i] ?? 0),
      pot_total: t.pot_total ?? money(0),
      items: itemSets[i] ?? [],
      top_contributors: contributors[i] ?? [],
    })),
    totals: {
      teams: ranked.length,
      players: ranked.reduce((n, t) => n + t.member_count, 0),
      tasks: detail.tasks.length,
      loot_gp: money(353_700_000),
    },
  };
}

/** One player's contribution drill-down (Players tab row expand). */
export function mockEventPlayerDetail(eventId: number, playerId: number): EventPlayerDetail {
  const now = Math.floor(Date.now() / 1000);
  const event = mockEvents().find((e) => e.id === eventId) ?? mockEvents()[0]!;
  const roster = mockEventPlayers(eventId).players;
  const p = roster.find((x) => x.player_id === playerId) ?? roster[0]!;
  return {
    event,
    player: {
      player_id: p.player_id ?? playerId,
      player_name: p.player_name,
      team_id: p.team_id,
      team_name: p.team_name,
      team_color: p.team_color,
      role: p.role,
      points: p.points,
      completions: p.completions,
      quantity: p.quantity,
      tasks_contributed: p.tasks_contributed,
      loot_gp: p.loot_gp ?? money(96_500_000),
    },
    items: p.items.length
      ? p.items
      : [{ name: "Twisted bow", item_id: 20997, quantity: 1, drops: 1 }],
    tasks: [
      {
        task_id: 12,
        task_label: "Obtain a Twisted bow",
        task_type: "item_collection",
        completions: 1,
        quantity: 1,
        points: 20,
      },
      {
        task_id: 11,
        task_label: "Vorkath 50 KC",
        task_type: "kc_target",
        completions: 4,
        quantity: 4,
        points: 22.5,
      },
    ],
    activity: [
      {
        id: 900,
        task_id: 12,
        task_label: "Obtain a Twisted bow",
        quantity: 1,
        source_type: "drop",
        matched_target: "Twisted bow",
        created_at: now - 3600,
      },
      {
        id: 899,
        task_id: 11,
        task_label: "Vorkath 50 KC",
        quantity: 1,
        source_type: "kc",
        matched_target: null,
        created_at: now - 5400,
      },
    ],
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
    {
      id: 1,
      name: "Abyssal whip",
      description: "Obtain an Abyssal whip",
      type: "item_collection",
      target: "Abyssal whip",
      target_value: 1,
      default_points: 5,
      difficulty: "air",
      source: "legacy_v1",
      group_id: null,
      visibility: "public",
      config: null,
    },
    {
      id: 2,
      name: "Full Barrows set",
      description: "Collect any complete Barrows set",
      type: "item_collection",
      target: null,
      target_value: null,
      default_points: 25,
      difficulty: "earth",
      source: "legacy_v1",
      group_id: null,
      visibility: "public",
      config: '{"kind":"any_of","items":["Dharok\'s helm","Dharok\'s platebody"]}',
    },
    {
      id: 3,
      name: "Zulrah 50 KC",
      description: "Kill Zulrah 50 times",
      type: "kc_target",
      target: "Zulrah",
      target_value: 50,
      default_points: 15,
      difficulty: "water",
      source: "group",
      group_id: 1,
      visibility: "public",
      config: null,
    },
    {
      id: 4,
      name: "Sub-20 Grotesque Guardians",
      description: "Beat the Guardians in under 20 minutes",
      type: "pb_target",
      target: "Grotesque Guardians",
      target_value: 1200,
      default_points: 30,
      difficulty: "fire",
      source: "group",
      group_id: 1,
      visibility: "private",
      config: null,
    },
    {
      id: 5,
      name: "Twisted bow",
      description: "Obtain a Twisted bow",
      type: "item_collection",
      target: "Twisted bow",
      target_value: 1,
      default_points: 100,
      difficulty: "fire",
      source: "legacy_v1",
      group_id: null,
      visibility: "public",
      config: null,
    },
  ];
  const q = (query ?? "").trim().toLowerCase();
  return all.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)) &&
      (!type || i.type === type),
  );
}

/** Saved event templates for the "start from a template" picker. */
export function mockEventTemplates(query?: string): EventTemplateSummary[] {
  const now = Math.floor(Date.now() / 1000);
  const all: EventTemplateSummary[] = [
    {
      id: 1,
      name: "Classic 5x5 Bingo",
      description: "A balanced 5x5 board for 2-4 teams — the standard clan bingo.",
      source_event_id: 1,
      group_id: null,
      visibility: "public",
      mode: "standard",
      has_bingo: true,
      board_size: 5,
      task_count: 25,
      team_count: 2,
      times_used: 14,
      created_at: now - 30 * 86400,
      updated_at: now - 7 * 86400,
    },
    {
      id: 2,
      name: "Winter Skilling Race",
      description: "XP-target sprint across six skills, no board.",
      source_event_id: 2,
      group_id: 1,
      visibility: "private",
      mode: "standard",
      has_bingo: false,
      board_size: 5,
      task_count: 6,
      team_count: 3,
      times_used: 2,
      created_at: now - 14 * 86400,
      updated_at: now - 14 * 86400,
    },
  ];
  const q = (query ?? "").trim().toLowerCase();
  return all.filter(
    (t) =>
      !q || t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
  );
}

export function mockEventTemplateDetail(id: number): EventTemplateDetail {
  const summary = mockEventTemplates().find((t) => t.id === id) ?? mockEventTemplates()[0]!;
  return {
    ...summary,
    preview: {
      description: summary.description,
      formation_mode: "self_join",
      requires_confirmation: false,
      submission_policy: "all",
      bonus_line_points: 5,
      bonus_blackout_points: 25,
      tasks: [
        {
          type: "item_collection",
          label: "Abyssal whip",
          target: "Abyssal whip",
          target_value: 1,
          points: 5,
        },
        {
          type: "kc_target",
          label: "Zulrah 50 KC",
          target: "Zulrah",
          target_value: 50,
          points: 15,
        },
        {
          type: "pb_target",
          label: "Sub-20 Grotesque Guardians",
          target: "Grotesque Guardians",
          target_value: 1200,
          points: 30,
        },
      ],
      teams: ["Team Red", "Team Blue"],
    },
  };
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
    scheduled_event: {
      id: "777777777777777777",
      status: "synced",
      last_error: null,
    },
    discord_event_policy: "on_activate",
    pings: {
      event_created: ["888888888888888888"],
    },
    // Mirrors the backend defaults (services/event_notifications.py).
    messages: {
      toggles: {
        event_started: true,
        event_ended: true,
        event_completion: true,
        event_task_progress: true,
        event_line: true,
        event_blackout: true,
        event_lead_change: true,
        event_pending: true,
        event_activation_failed: true,
      },
      task_progress: "off",
      item_details: true,
      leaderboard: { live: true, top_n: 10, show_tasks: true },
    },
    per_group_discord: false,
    group_id: null,
  };
}

/** Per-team Discord channels & roles (web53a). */
export function mockEventTeamDiscord(
  _eventId: number,
  groupId: number | null,
): EventTeamDiscordConfig {
  return {
    group_id: groupId,
    guild_id: "444444444444444444",
    channels_enabled: true,
    roles_enabled: true,
    forum_channel_id: null,
    category_channel_id: null,
    retention: "delete_48h",
    captain_config: true,
    teams: [
      {
        team_id: 1,
        name: "Team Red",
        role_enabled: true,
        channel_enabled: true,
        toggles: {},
        pings: {},
        task_progress: "all",
        role_id: "999999999999999901",
        channel_id: "999999999999999902",
        channel_kind: "text",
        sync_status: "synced",
        last_error: null,
      },
      {
        team_id: 2,
        name: "Team Blue",
        role_enabled: true,
        channel_enabled: false,
        toggles: { event_board_turn: false },
        pings: { event_completion: false },
        task_progress: "milestones",
        role_id: null,
        channel_id: null,
        channel_kind: null,
        sync_status: "pending",
        last_error: null,
      },
    ],
    default_toggles: {
      event_completion: true,
      event_task_progress: true,
      event_line: true,
      event_blackout: true,
      event_lead_change: true,
      event_board_turn: true,
      event_board_roll_prompt: true,
    },
    default_pings: {
      event_completion: true,
      event_task_progress: false,
      event_line: true,
      event_blackout: true,
      event_lead_change: true,
      event_board_turn: false,
      event_board_roll_prompt: true,
    },
    default_task_progress: "milestones",
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
      { id: "111111111111111111", name: "drops", position: 0, type: "text" as const },
      { id: "222222222222222222", name: "leaderboard", position: 1, type: "text" as const },
      { id: "333333333333333333", name: "announcements", position: 2, type: "text" as const },
      { id: "666666666666666666", name: "event-hub", position: 3, type: "forum" as const },
      {
        id: "777777777777777777",
        name: "completions",
        position: 3,
        type: "thread" as const,
        parent_id: "666666666666666666",
      },
      { id: "888888888888888888", name: "Event Teams", position: 4, type: "category" as const },
    ],
    stale: false,
  };
}

export function mockLookup(q: string): AdminLookupResponse {
  return {
    results: [
      {
        category: "player",
        id: "1337",
        label: `Zezima (matches "${q}")`,
        detail: "rank #1",
        href: "/players/1337",
      },
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
        content:
          "I changed my RSN yesterday and my drops stopped tracking. <@100000000000000001> can you help?",
        attachments: [
          {
            filename: "screenshot.png",
            url: "/img/tickets/1/screenshot.png",
            content_type: "image/png",
            size: 12345,
          },
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
        content: "On it <@100000000000000002> — your accounts are linked again. Give it a minute!",
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
    mentions: { "100000000000000001": "joelhalen", "100000000000000002": "zezima" },
  };
}

export function mockSuggestionSummary(
  id: number,
  status: SuggestionSummary["status"] = "posted",
): SuggestionSummary {
  const bug = id % 2 === 0;
  return {
    id,
    type: bug ? "bug" : "suggestion",
    title: bug ? "Lootboard skips seasonal drops" : "Add a dark theme for lootboards",
    status,
    origin: id % 3 === 0 ? "discord" : "web",
    is_open: true,
    author_name: id % 3 === 0 ? "zezima" : "joelhalen",
    author_user_id: id % 3 === 0 ? null : 1,
    excerpt: bug
      ? "My seasonal drops stopped showing on the lootboard. Step 1 Step 2"
      : "A darker board theme would fit the site better at night.",
    message_count: id % 3,
    discord_thread_url: status === "posted" ? `https://discord.com/channels/1/${1000 + id}` : null,
    created_at: MOCK_NOW - 86_400 * id,
    last_activity_at: MOCK_NOW - 3_600 * id,
  };
}

export function mockSuggestions(page = 1): SuggestionPage {
  return {
    items: [
      mockSuggestionSummary(3, "pending"),
      mockSuggestionSummary(2),
      mockSuggestionSummary(1),
    ],
    meta: { page, limit: 25, total: 3 },
  };
}

export function mockSuggestionDetail(id: number): SuggestionDetail {
  return {
    ...mockSuggestionSummary(id),
    body_md:
      "**What happened**\n\nMy seasonal drops stopped showing on the lootboard.\n\n- Step 1\n- Step 2",
    messages: [
      {
        id: 1,
        author_name: "zezima",
        author_user_id: null,
        source: "discord",
        content: "Seeing the same thing since Tuesday.",
        created_at: MOCK_NOW - 7_200,
        edited_at: null,
      },
      {
        id: 2,
        author_name: "joelhalen",
        author_user_id: 1,
        source: "web",
        content: "Thanks <@100000000000000002> — reproduced, fix incoming.",
        created_at: MOCK_NOW - 3_600,
        edited_at: null,
      },
    ],
    mentions: { "100000000000000002": "zezima" },
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

export function mockManualSubmissions(): ManualSubmissionQueue {
  const now = Math.floor(Date.now() / 1000);
  return {
    pending: [
      {
        drop_id: 900001,
        status: "pending",
        player_id: 1337,
        player_name: "Zezima",
        item_id: 20997,
        item_name: "Twisted bow",
        npc_name: "Chambers of Xeric",
        quantity: 1,
        value: money(1_100_000_000),
        image_url: "https://www.droptracker.io/img/itemdb/20997.png",
        submitted_ts: now - 1800,
        reviewed_ts: null,
        reason: "policy:confirm",
      },
    ],
    recent: [
      {
        drop_id: 900000,
        status: "approved",
        player_id: 1338,
        player_name: "Woox",
        item_id: 22486,
        item_name: "Scythe of vitur",
        npc_name: "Theatre of Blood",
        quantity: 1,
        value: money(780_000_000),
        image_url: null,
        submitted_ts: now - 90_000,
        reviewed_ts: now - 86_000,
        reason: "policy:confirm",
      },
    ],
    pending_count: 1,
  };
}
