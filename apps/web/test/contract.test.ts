import assert from "node:assert/strict";
import { test } from "node:test";
import {
  B2UsageSchema,
  BackupOffsiteSchema,
  BackupOverviewSchema,
  AdminLookupResponseSchema,
  AdminSubscriptionsOverviewSchema,
  AnnouncementPageSchema,
  AdminTicketPageSchema,
  GroupSubscriptionSchema,
  GroupSubscriptionSummarySchema,
  EventDetailSchema,
  EventTeamDetailSchema,
  EventSummarySchema,
  EventPrizePotSchema,
  EventTeamDiscordConfigSchema,
  TeamNotificationsSchema,
  TaskBreakdownSchema,
  BingoCellSchema,
  EventProgressSchema,
  TicketDetailSchema,
  TicketPageSchema,
  GroupConfigPatchSchema,
  LeaderboardPageSchema,
  LootboardSchema,
  LootSweepBoardSchema,
  LootSweepReceiptsSchema,
  ItemDetailSchema,
  MeSchema,
  EventManagersResponseSchema,
  NpcDetailSchema,
  NpcDropTableSchema,
  PbBossBoardSchema,
  PbBossIndexSchema,
  PlayerLootTrackerSchema,
  PlayerProfileSchema,
  SearchResultsSchema,
  ResolveResultSchema,
  ServiceStatusSchema,
  SupportersSchema,
  allConfigKeys,
  getConfigField,
} from "@droptracker/api-types";
import openapi from "@droptracker/api-types/openapi" with { type: "json" };
import {
  mockB2Usage,
  mockBackupOffsite,
  mockBackupOverview,
  mockAnnouncements,
  mockEvent,
  mockEventLootSweep,
  mockEventLootSweepReceipts,
  mockEventTeam,
  mockEvents,
  mockAdminSubscriptionsOverview,
  mockAdminTickets,
  mockGroupSubscription,
  mockItemDetail,
  mockNpcDetail,
  mockNpcDropTable,
  mockSearch,
  mockGroupSubscriptionSummary,
  mockLookup,
  mockLootboard,
  mockMyTickets,
  mockTicket,
  mockMe,
  mockEventManagers,
  mockPbBoard,
  mockPbBosses,
  mockPlayerLeaderboard,
  mockPlayerLoot,
  mockPlayerProfile,
  mockResolve,
  mockServices,
  mockSupporters,
} from "../lib/mock-data";

// Contract test: every path the BFF client calls must exist in the published
// OpenAPI spec (FRONTEND_PLAN.md §20.4 "contract test against OpenAPI").
test("OpenAPI spec declares the public-read surface the BFF consumes", () => {
  const paths = Object.keys((openapi as { paths: Record<string, unknown> }).paths);
  for (const expected of [
    "/leaderboards/players",
    "/leaderboards/groups",
    "/players/{playerId}",
    "/groups/{groupId}",
    "/announcements",
    "/me",
    "/npcs/{npcId}",
    "/npcs/{npcId}/drop-table",
    "/items/{itemId}",
    "/resolve/{kind}",
  ]) {
    assert.ok(paths.includes(expected), `OpenAPI missing path ${expected}`);
  }
});

// The mock payloads must satisfy the shared Zod schemas, guaranteeing the
// fallback data matches the contract the real API will return.
test("mock payloads validate against shared schemas", () => {
  assert.doesNotThrow(() => LeaderboardPageSchema.parse(mockPlayerLeaderboard(1, 10)));
  assert.doesNotThrow(() => PlayerProfileSchema.parse(mockPlayerProfile(42)));
  assert.doesNotThrow(() => PlayerLootTrackerSchema.parse(mockPlayerLoot(42)));
  assert.doesNotThrow(() => AnnouncementPageSchema.parse(mockAnnouncements()));
  assert.doesNotThrow(() => MeSchema.parse(mockMe()));
  assert.doesNotThrow(() => EventManagersResponseSchema.parse(mockEventManagers()));
  assert.doesNotThrow(() => ServiceStatusSchema.array().parse(mockServices()));
  assert.doesNotThrow(() => BackupOverviewSchema.parse(mockBackupOverview()));
  assert.doesNotThrow(() => BackupOffsiteSchema.parse(mockBackupOffsite()));
  assert.doesNotThrow(() => B2UsageSchema.parse(mockB2Usage()));
  assert.doesNotThrow(() => AdminLookupResponseSchema.parse(mockLookup("zez")));
  assert.doesNotThrow(() => LootboardSchema.parse(mockLootboard(42, "all")));
  assert.doesNotThrow(() => EventSummarySchema.array().parse(mockEvents()));
  assert.doesNotThrow(() => EventDetailSchema.parse(mockEvent(1)));
  assert.doesNotThrow(() => EventDetailSchema.parse(mockEvent(3)));
  assert.doesNotThrow(() => EventDetailSchema.parse(mockEvent(4)));
  assert.doesNotThrow(() => LootSweepBoardSchema.parse(mockEventLootSweep(3)));
  assert.doesNotThrow(() => LootSweepBoardSchema.parse(mockEventLootSweep(4)));
  assert.doesNotThrow(() =>
    LootSweepReceiptsSchema.parse(mockEventLootSweepReceipts(3, 41, "Armadyl helmet")),
  );
  assert.doesNotThrow(() => EventTeamDetailSchema.parse(mockEventTeam(1, 21)));
  assert.doesNotThrow(() => GroupSubscriptionSchema.parse(mockGroupSubscription(101)));
  assert.doesNotThrow(() => GroupSubscriptionSummarySchema.parse(mockGroupSubscriptionSummary(101)));
  assert.doesNotThrow(() => AdminSubscriptionsOverviewSchema.parse(mockAdminSubscriptionsOverview()));
  assert.doesNotThrow(() => TicketPageSchema.parse(mockMyTickets()));
  assert.doesNotThrow(() => TicketDetailSchema.parse(mockTicket(2)));
  assert.doesNotThrow(() => AdminTicketPageSchema.parse(mockAdminTickets()));
  assert.doesNotThrow(() => SupportersSchema.parse(mockSupporters()));
  assert.doesNotThrow(() => PbBossIndexSchema.parse(mockPbBosses()));
  assert.doesNotThrow(() => PbBossIndexSchema.parse(mockPbBosses(101)));
  assert.doesNotThrow(() => PbBossBoardSchema.parse(mockPbBoard(13696)));
  assert.doesNotThrow(() => PbBossBoardSchema.parse(mockPbBoard(13696, 101)));
  assert.doesNotThrow(() => NpcDetailSchema.parse(mockNpcDetail(8060)));
  assert.doesNotThrow(() => NpcDropTableSchema.parse(mockNpcDropTable(8060)));
  assert.doesNotThrow(() => ItemDetailSchema.parse(mockItemDetail(22006)));
  assert.doesNotThrow(() => SearchResultsSchema.parse(mockSearch("vork")));
  // Slug resolution: a single match and an ambiguous (disambiguation) result.
  assert.doesNotThrow(() => ResolveResultSchema.parse(mockResolve("npc", "vorkath")));
  assert.doesNotThrow(() => ResolveResultSchema.parse(mockResolve("group", "dup-clan")));
});

// Older API deployments answer /search without npcs/items — the schema must
// default them to empty arrays rather than failing the whole search page.
test("SearchResults tolerates missing npcs/items sections", () => {
  const parsed = SearchResultsSchema.parse({ players: [], groups: [] });
  assert.deepEqual(parsed.npcs, []);
  assert.deepEqual(parsed.items, []);
});

// The backend serializes an empty event description as JSON null (not omitted).
// A plain `.optional()` on the Zod schema rejected null, so a single
// description-less event made the whole /events list parse throw and blanked
// the group-admin events page. Lock in that null (and undefined) are accepted.
test("EventSummary accepts null/absent description", () => {
  const base = {
    id: 1,
    group_id: 267,
    name: "Koeppy Test",
    status: "draft" as const,
    starts_at: null,
    ends_at: null,
    has_bingo: false,
    formation_mode: "admin_assign" as const,
    requires_confirmation: false,
    submission_policy: "all" as const,
    board_size: 5,
    bonus_line_points: 0,
    bonus_blackout_points: 0,
  };
  assert.doesNotThrow(() => EventSummarySchema.parse({ ...base, description: null }));
  assert.doesNotThrow(() => EventSummarySchema.parse(base));
  assert.doesNotThrow(() => EventSummarySchema.parse({ ...base, description: "hi" }));
  // A mixed list (one with, one without a description) must fully parse.
  assert.doesNotThrow(() =>
    EventSummarySchema.array().parse([
      { ...base, id: 2, name: "Bingo Test!", status: "active", description: "Let's go" },
      { ...base, id: 3, description: null },
    ]),
  );
});

// Prize pot (web52a): the full pot read + the lightweight EventDetail block.
test("EventPrizePot read + EventDetail prize_pot block parse", () => {
  const money = (v: number) => ({ value: v, value_formatted: String(v) });
  assert.doesNotThrow(() =>
    EventPrizePotSchema.parse({
      enabled: true,
      total: money(250_000_000),
      buyin_total: money(200_000_000),
      donation_total: money(50_000_000),
      config: {
        default_buyin: money(5_000_000),
        distribution: "top_n",
        top_n: 2,
        splits: [100],
        advertise: true,
        show_contributors: true,
        allow_leader_mark: false,
      },
      per_team: [
        { team_id: 3, name: "Red", total: money(120_000_000), paid_count: 8, member_count: 10 },
      ],
      contributors: [
        {
          id: 41,
          player_id: 55,
          rsn: "Zezima",
          team_id: 3,
          kind: "donation",
          amount: money(50_000_000),
          status: "paid",
        },
      ],
      can_manage: true,
    }),
  );
  // contributors null (redacted) is valid.
  assert.doesNotThrow(() =>
    EventPrizePotSchema.parse({
      enabled: true,
      total: money(0),
      buyin_total: money(0),
      donation_total: money(0),
      config: {
        default_buyin: money(0),
        distribution: "first_only",
        top_n: 1,
        splits: [100],
        advertise: false,
        show_contributors: false,
        allow_leader_mark: false,
      },
      per_team: [],
      contributors: null,
      can_manage: false,
    }),
  );
  // The EventDetail prize_pot summary block, and a team carrying pot_total.
  const parsed = EventDetailSchema.parse({
    ...mockEvent(1),
    prize_pot: {
      enabled: true,
      total: money(250_000_000),
      advertise: true,
      distribution: "top_n",
      top_n: 2,
    },
  });
  assert.equal(parsed.prize_pot?.enabled, true);
});

// Per-team Discord channels & roles (web53a): config scope + provisioning state.
test("EventTeamDiscordConfig parse", () => {
  assert.doesNotThrow(() =>
    EventTeamDiscordConfigSchema.parse({
      group_id: null,
      guild_id: "444444444444444444",
      channels_enabled: true,
      roles_enabled: true,
      forum_channel_id: "666666666666666666",
      retention: "delete_48h",
      captain_config: true,
      teams: [
        {
          team_id: 1,
          name: "Reds",
          role_enabled: true,
          channel_enabled: true,
          toggles: { event_board_roll_prompt: true },
          task_progress: "all",
          role_id: "1",
          channel_id: "2",
          channel_kind: "thread",
          sync_status: "synced",
          last_error: null,
        },
        {
          team_id: 2,
          name: "Blues",
          role_enabled: false,
          channel_enabled: false,
          toggles: {},
          task_progress: "off",
          role_id: null,
          channel_id: null,
          channel_kind: null,
          sync_status: null,
          last_error: null,
        },
      ],
      default_toggles: { event_completion: true },
      default_task_progress: "all",
    }),
  );
  assert.doesNotThrow(() =>
    TeamNotificationsSchema.parse({
      team_id: 4,
      toggles: { event_lead_change: false },
      task_progress: "milestones",
    }),
  );
});

// Pending-review overlay (web53a): progress rows, bingo cells and the task
// breakdown all optionally carry pending state — and legacy payloads without
// it must keep parsing.
test("pending-review overlay fields parse (and stay optional)", () => {
  const withPending = EventProgressSchema.parse({
    task_id: 1,
    team_id: 2,
    progress: 3,
    completed: false,
    completed_at: null,
    pending: 2,
    pending_complete: true,
  });
  assert.equal(withPending.pending_complete, true);
  // Legacy row without the overlay.
  assert.doesNotThrow(() =>
    EventProgressSchema.parse({ task_id: 1, team_id: 2, progress: 3, completed: true }),
  );

  const cell = BingoCellSchema.parse({
    index: 0,
    label: "Get a whip",
    task_id: 9,
    completed_by: [],
    pending_teams: [2],
    pending_partial_teams: [3],
  });
  assert.deepEqual(cell.pending_teams, [2]);

  assert.doesNotThrow(() =>
    TaskBreakdownSchema.parse({
      task_id: 9,
      team_id: 2,
      team_name: "Reds",
      type: "item_collection",
      kind: "all_of",
      progress: 2,
      target: 3,
      completed: false,
      wildcard: 0,
      structure: "checklist",
      groups: [
        {
          mode: "all_of",
          need: 3,
          obtained: 2,
          satisfied: false,
          pending_satisfied: true,
          items: [
            {
              name: "Dragon pickaxe",
              required: 1,
              obtained: 0,
              satisfied: false,
              pending: 1,
              pending_satisfied: true,
            },
          ],
        },
      ],
      contributors: [],
      pending_count: 1,
      pending_complete: true,
    }),
  );
});

// Every config key (incl. seasonal mirrors) must resolve to a field — guards the
// `seasonal_boards` prefix collision (a base key that starts with `seasonal_`).
test("group-config registry resolves all keys", () => {
  for (const key of allConfigKeys()) {
    assert.ok(getConfigField(key), `unresolved config field for key ${key}`);
  }
  assert.equal(getConfigField("seasonal_boards")?.key, "seasonal_boards");
  // An empty patch is always valid (PATCH sends only changed keys).
  assert.doesNotThrow(() => GroupConfigPatchSchema.parse({}));
});
