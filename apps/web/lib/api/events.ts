import { z } from "zod";
import { apiGet, apiSend, apiSendForm, withFallback } from "./_client";
import { CompletionHistorySchema, EventAuditSchema, type CompletionHistory, type CompletionHistoryMode, type EventAudit, type EventAuditParams } from "./types";
import {
  BingoBoardSchema,
  BoardDetailSchema,
  type BoardDetail,
  LootSweepBoardSchema,
  type LootSweepBoard,
  LootSweepReceiptsSchema,
  type LootSweepReceipts,
  LootSweepSummarySchema,
  type LootSweepSummary,
  BoardRollResultSchema,
  type BoardRollResult,
  BoardSettingsSchema,
  type BoardSettings,
  type BoardInput,
  BoardShopStateSchema,
  type BoardShopState,
  BoardShopConfigSchema,
  type BoardShopConfig,
  type BoardShopConfigInput,
  AdminShopItemSchema,
  type AdminShopItem,
  EventCompletionSchema,
  EventDetailSchema,
  EventReadinessSchema,
  EventKindMetaSchema,
  type EventKindMeta,
  EventTeamDetailSchema,
  EventTeamsResponseSchema,
  EventTeamContributionsSchema,
  type EventTeamDetail,
  type EventTeamsResponse,
  type EventTeamContributions,
  EventPlayersResponseSchema,
  type EventPlayersResponse,
  EventPlayerDetailSchema,
  type EventPlayerDetail,
  EventEffortReportSchema,
  type EventEffortReport,
  TaskBreakdownSchema,
  type TaskBreakdown,
  TaskRequirementsSchema,
  type TaskRequirements,
  EventSummarySchema,
  type BingoBoard,
  type BingoBoardInput,
  type EventAwardInput,
  type EventCompletion,
  type EventDetail,
  type EventReadiness,
  type EventInput,
  type EventRevokeInput,
  type EventSummary,
  type EventTeamInput,
  type EventTeamPatch,
} from "@droptracker/api-types";
import {
  mockEvent,
  mockEventTeam,
  mockEventTeams,
  mockEventPlayers,
  mockEventPlayerDetail,
  mockEventEffortReport,
  mockEventCompletions,
  mockEventLootSweep,
  mockEventLootSweepReceipts,
  mockEvents,
  mockEventsMine,
} from "../mock-data";

export const eventsApi = {

  // --- Events ------------------------------------------------------------
  async events(
    params: { groupId?: number; status?: "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams();
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () =>
        EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { revalidate: 30 })),
      () => mockEvents(params.groupId, params.status),
    );
  },


  /** Authed event list: same endpoint, but with the session cookie so the
   * backend includes drafts the viewer administers (superadmin sees all,
   * including global drafts). Uncached (viewer-specific). */
  async eventsForAdmin(
    params: { groupId?: number; status?: "draft" | "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams();
    if (params.groupId) q.set("groupId", String(params.groupId));
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () => EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { authed: true })),
      () => mockEvents(params.groupId, params.status),
    );
  },


  /** The viewer's clan events (GET /events?mine=true): events of every group
   * the session user belongs to or administers, plus clan-vs-clan events those
   * groups accepted as opponents. Anonymous callers get []. Authed + uncached
   * (viewer-specific). Powers the /events glow buttons. */
  async eventsMine(
    params: { status?: "draft" | "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams({ mine: "true" });
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () => EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { authed: true })),
      () => mockEventsMine(params.status),
    );
  },


  async event(id: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiGet(`/events/${id}`, { revalidate: 30 })),
      () => mockEvent(id),
    );
  },


  /** Event detail for the chrome-less board-image render — reads ANY event
   * (incl. private/draft) via the internal render token, no mock fallback. */
  async eventForRender(id: number, token: string): Promise<EventDetail> {
    return EventDetailSchema.parse(await apiGet(`/events/${id}`, { internalToken: token }));
  },


  /** Board-game board for the render page (internal render token). */
  async eventBoardForRender(eventId: number, token: string): Promise<BoardDetail> {
    return BoardDetailSchema.parse(
      await apiGet(`/events/${eventId}/board`, { internalToken: token }),
    );
  },


  /** Compact Loot Sweep standings for the render page (internal render token) —
   * the leaderboard the Discord board image screenshots. */
  async eventLootSweepSummaryForRender(
    eventId: number,
    token: string,
  ): Promise<LootSweepSummary> {
    return LootSweepSummarySchema.parse(
      await apiGet(`/events/${eventId}/loot-sweep/summary`, { internalToken: token }),
    );
  },


  /** Public team page: standings context, roster with contribution stats,
   * per-task progress, recent applied activity. */
  async eventTeam(eventId: number, teamId: number): Promise<EventTeamDetail> {
    return withFallback(
      async () =>
        EventTeamDetailSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}`, { revalidate: 15 }),
        ),
      () => mockEventTeam(eventId, teamId),
    );
  },


  /** Authed team read: same payload, but with the session cookie so members
   * of participating clans can view teams on private events. Uncached
   * (viewer-specific). */
  async eventTeamAuthed(eventId: number, teamId: number): Promise<EventTeamDetail> {
    return withFallback(
      async () =>
        EventTeamDetailSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}`, { authed: true }),
        ),
      () => mockEventTeam(eventId, teamId),
    );
  },


  /** Teams-tab standings rollup: rank/score plus tasks-done, pot share,
   * event-window loot GP, top task-credited items, and top contributors per
   * team — one self-sufficient payload. Cached. */
  async eventTeams(eventId: number): Promise<EventTeamsResponse> {
    return withFallback(
      async () =>
        EventTeamsResponseSchema.parse(
          await apiGet(`/events/${eventId}/teams`, { revalidate: 15 }),
        ),
      () => mockEventTeams(eventId),
    );
  },


  /** Authed variant — session cookie so members can see the Teams tab on a
   * draft (pre-publication) event. Uncached (viewer-specific). */
  async eventTeamsAuthed(eventId: number): Promise<EventTeamsResponse> {
    return withFallback(
      async () =>
        EventTeamsResponseSchema.parse(
          await apiGet(`/events/${eventId}/teams`, { authed: true }),
        ),
      () => mockEventTeams(eventId),
    );
  },


  /** One team's submission log (t62): who contributed what, when, with the
   * screenshot — the same applied ledger rows the completion history serves,
   * scoped to one team and with metric progress ticks rolled up. Forwards the
   * session so admins see hidden tasks / real RSNs. Newest-first, paginated. */
  async eventTeamContributions(
    eventId: number,
    teamId: number,
    params: { page?: number; limit?: number } = {},
  ): Promise<EventTeamContributions> {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    return withFallback(
      async () =>
        EventTeamContributionsSchema.parse(
          await apiGet(`/events/${eventId}/teams/${teamId}/contributions?${q}`, {
            authed: true,
          }),
        ),
      () => ({
        event_id: eventId,
        team_id: teamId,
        team_name: null,
        is_admin: false,
        entries: [],
        meta: {
          page: params.page ?? 1,
          limit: params.limit ?? 25,
          total: 0,
          folded_updates: 0,
          truncated: false,
        },
      }),
    );
  },


  /** Event-wide player contribution leaderboard (Players tab), cached. */
  async eventPlayers(eventId: number): Promise<EventPlayersResponse> {
    return withFallback(
      async () =>
        EventPlayersResponseSchema.parse(
          await apiGet(`/events/${eventId}/players`, { revalidate: 15 }),
        ),
      () => mockEventPlayers(eventId),
    );
  },


  /** Authed variant — session cookie so members can see the Players tab on a
   * draft (pre-publication) event. Uncached (viewer-specific). */
  async eventPlayersAuthed(eventId: number): Promise<EventPlayersResponse> {
    return withFallback(
      async () =>
        EventPlayersResponseSchema.parse(
          await apiGet(`/events/${eventId}/players`, { authed: true }),
        ),
      () => mockEventPlayers(eventId),
    );
  },


  /** Bingo EHB participation report — event managers only. Lists the WHOLE
   * roster quietest first, including members with no recorded effort (they're
   * the point). Uncached: it drives "who do I chase today". */
  async eventEffortReport(eventId: number): Promise<EventEffortReport> {
    return withFallback(
      async () =>
        EventEffortReportSchema.parse(
          await apiGet(`/events/${eventId}/effort`, { authed: true }),
        ),
      () => mockEventEffortReport(eventId),
    );
  },


  /** One player's full contribution drill-down (items + per-task + activity).
   * Authed (draft visibility); fetched on-demand when a row is expanded. */
  async eventPlayerDetail(eventId: number, playerId: number): Promise<EventPlayerDetail> {
    return withFallback(
      async () =>
        EventPlayerDetailSchema.parse(
          await apiGet(`/events/${eventId}/players/${playerId}`, { authed: true }),
        ),
      () => mockEventPlayerDetail(eventId, playerId),
    );
  },


  /** Per-(task, team) item-level breakdown: which requirements a team has
   * obtained vs still needs, plus who contributed. `teamId` selects the team;
   * omit to default to the viewer's own team (resolved server-side). Authed so
   * the viewer default + draft visibility work. Uncached (viewer-specific). */
  async taskBreakdown(
    eventId: number,
    taskId: number,
    teamId?: number,
  ): Promise<TaskBreakdown> {
    const q = teamId != null ? `?team_id=${teamId}` : "";
    return withFallback(
      async () =>
        TaskBreakdownSchema.parse(
          await apiGet(`/events/${eventId}/tasks/${taskId}/breakdown${q}`, { authed: true }),
        ),
      () => ({
        task_id: taskId,
        team_id: teamId ?? 0,
        team_name: null,
        type: "custom" as const,
        kind: null,
        progress: 0,
        target: 1,
        completed: false,
        wildcard: 0,
        structure: "meter" as const,
        meter: { progress: 0, target: 1, unit: "", binary: false, label: null, target_value: null },
        contributors: [],
      }),
    );
  },

  /** What actually counts for a task — every qualifying item/pet/NPC named and
   * icon-resolved, with no team in the picture. Team-independent (so it works
   * before teams exist, and for an organiser proof-reading a task), and
   * cacheable: the answer only changes when the task is edited. */
  async taskRequirements(eventId: number, taskId: number): Promise<TaskRequirements> {
    return withFallback(
      async () =>
        TaskRequirementsSchema.parse(
          await apiGet(`/events/${eventId}/tasks/${taskId}/requirements`, { authed: true }),
        ),
      () => ({
        task_id: taskId,
        label: null,
        type: "custom" as const,
        kind: null,
        summary: "",
        groups: [],
        paths: [],
        npcs: [],
        notes: [],
      }),
    );
  },


  /** Authed event read: includes the viewer block and, for event admins, the
   * join code. Uncached (viewer-specific). */
  async eventForAdmin(id: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiGet(`/events/${id}`, { authed: true })),
      () => mockEvent(id),
    );
  },


  async createEvent(input: EventInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events`, input)) as { id: number },
      () => ({ id: Math.floor(100 + Math.random() * 900) }),
    );
  },


  /** Event kinds for the create form: every registry row, each annotated
   * with `creatable` for the current viewer + group (web43a). */
  async eventKinds(groupId: number | null): Promise<EventKindMeta[]> {
    const qs = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        EventKindMetaSchema.array().parse(
          await apiGet(`/events/meta/types${qs}`, { authed: true }),
        ),
      () => [
        { key: "standard", label: "Standard", description: null, enabled: true, admin_only: false, creatable: true },
        { key: "bingo", label: "Bingo", description: null, enabled: true, admin_only: false, creatable: true },
        { key: "board_game", label: "Board game", description: null, enabled: true, admin_only: true, creatable: false },
      ],
    );
  },


  async updateEvent(
    eventId: number,
    patch: Partial<
      Pick<
        EventInput,
        | "name"
        | "description"
        | "starts_at"
        | "ends_at"
        // Recurring schedule (web82a): an explicit null clears it, an absent
        // key leaves it alone (a date-only edit still re-materializes it).
        | "schedule"
        | "formation_mode"
        | "join_code"
        | "requires_confirmation"
        | "allow_live_edits"
        | "effort_visibility"
        | "allow_late_signups"
        | "submission_policy"
        | "bonus_line_points"
        | "bonus_blackout_points"
        | "mode"
        | "kind"
        | "visibility"
      >
    > & {
      /** Team-leadership knobs (web48a); partial objects merge server-side. */
      leadership?: {
        enabled?: boolean;
        co_leaders?: boolean;
        selection?: "admin" | "election";
      };
    },
  ): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("PATCH", `/events/${eventId}`, patch)),
      () => mockEvent(eventId),
    );
  },


  // --- Team leadership (web48a) ------------------------------------------------
  /** Assign a team's leader or co-leader (event admin; a leader may appoint
   * their own co-leader). */
  async setTeamLeadership(
    eventId: number,
    teamId: number,
    playerId: number,
    role: "leader" | "co_leader",
  ): Promise<void> {
    await apiSend("PUT", `/events/${eventId}/teams/${teamId}/leadership`, {
      player_id: playerId,
      role,
    });
  },


  /** Remove a leadership role (admin, the leader for a co-leader, or the
   * holder stepping down). */
  async clearTeamLeadership(eventId: number, teamId: number, playerId: number): Promise<void> {
    await apiSend("DELETE", `/events/${eventId}/teams/${teamId}/leadership/${playerId}`, {});
  },


  /** Cast/replace the viewer's vote for their team's leader (election mode). */
  async castLeaderVote(
    eventId: number,
    teamId: number,
    candidatePlayerId: number,
  ): Promise<{ leader_player_id: number | null }> {
    const res = (await apiSend("POST", `/events/${eventId}/teams/${teamId}/leader-vote`, {
      candidate_player_id: candidatePlayerId,
    })) as { leader_player_id?: number | null };
    return { leader_player_id: res?.leader_player_id ?? null };
  },


  // --- Event lifecycle (Task 21) ---------------------------------------------
  /** Explicit activation (draft -> active). 422 when the event isn't ready
   * (no teams / incomplete bingo board / end date in the past); 409 at the
   * tier's active-event limit. Returns the refreshed detail. */
  async activateEvent(eventId: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("POST", `/events/${eventId}/activate`, {})),
      () => ({ ...mockEvent(eventId), status: "active" as const }),
    );
  },


  /** Pre-flight the activation checks without activating — powers the manager's
   * "Check readiness" button. Read-only. */
  async eventReadiness(eventId: number): Promise<EventReadiness> {
    return withFallback(
      async () => EventReadinessSchema.parse(await apiGet(`/events/${eventId}/readiness`, { authed: true })),
      () => ({ status: "draft", ready: true, blockers: [], starts_at: null, auto_start: false, already_active: false }),
    );
  },


  /** Explicit end (active -> past). Final standings are announced to Discord. */
  async endEvent(eventId: number): Promise<EventDetail> {
    return withFallback(
      async () => EventDetailSchema.parse(await apiSend("POST", `/events/${eventId}/end`, {})),
      () => ({ ...mockEvent(eventId), status: "past" as const }),
    );
  },


  /** Permanently delete a draft or ended event and everything scoped to it.
   * The backend requires `confirm_name` to exactly match the event's name
   * (422 otherwise) and refuses to delete a live event (409 — end it first). */
  async deleteEvent(eventId: number, confirmName: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}`, { confirm_name: confirmName });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Bingo designer (Task 20) ---------------------------------------------
  /** Replace the event's whole bingo board. 409 once the event has started. */
  async saveEventBingo(eventId: number, input: BingoBoardInput): Promise<BingoBoard> {
    return withFallback(
      async () => BingoBoardSchema.parse(await apiSend("PUT", `/events/${eventId}/bingo`, input)),
      () => ({
        size: input.size,
        cells: input.cells
          .slice()
          .sort((a, b) => a.idx - b.idx)
          .map((c) => ({
            index: c.idx,
            label: c.label ?? c.new_task?.label ?? "Free space",
            task_id: c.task_id ?? null,
            completed_by: [],
            completions: [],
          })),
      }),
    );
  },


  // --- Board game (web44a) ----------------------------------------------------
  /** The whole board: tiles + settings + team positions (game view + designer). */
  async eventBoard(eventId: number): Promise<BoardDetail> {
    return BoardDetailSchema.parse(await apiGet(`/events/${eventId}/board`, { authed: true }));
  },


  /** Loot Sweep live board: every `loot_sweep` set with per-team, per-item
   * receipt counts + decayed points + set-bonus status. `authed` forwards the
   * session when present (to see restricted events) and tolerates anonymous. */
  async eventLootSweep(eventId: number): Promise<LootSweepBoard> {
    return withFallback(
      async () =>
        LootSweepBoardSchema.parse(await apiGet(`/events/${eventId}/loot-sweep`, { authed: true })),
      () => mockEventLootSweep(eventId),
    );
  },


  /** Loot Sweep hover card: per-team receipt ledger (who/when/points/proof)
   * for ONE item of a set. Fetched lazily the first time a cell's card opens. */
  async eventLootSweepReceipts(
    eventId: number,
    taskId: number,
    item: string,
  ): Promise<LootSweepReceipts> {
    const q = new URLSearchParams({ task_id: String(taskId), item });
    return withFallback(
      async () =>
        LootSweepReceiptsSchema.parse(
          await apiGet(`/events/${eventId}/loot-sweep/receipts?${q}`, { authed: true }),
        ),
      () => mockEventLootSweepReceipts(eventId, taskId, item),
    );
  },


  /** Public completion timeline (loot_sweep + every kind). Forwards the session
   * when present so admins see hidden tasks / the real RSN behind masked rows.
   * `mode` picks the raw ledger (`all`) vs. only rows that finished something
   * (`completions`) vs. only the GP/KC progress ticks (`progress`). */
  async eventCompletionHistory(
    eventId: number,
    params: {
      page?: number;
      teamId?: number;
      taskId?: number;
      player?: string;
      mode?: CompletionHistoryMode;
      taskType?: string;
    } = {},
  ): Promise<CompletionHistory> {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.teamId) q.set("teamId", String(params.teamId));
    if (params.taskId) q.set("taskId", String(params.taskId));
    if (params.player) q.set("player", params.player);
    if (params.mode) q.set("mode", params.mode);
    if (params.taskType) q.set("taskType", params.taskType);
    return withFallback(
      async () =>
        CompletionHistorySchema.parse(
          await apiGet(`/events/${eventId}/completions/history?${q}`, { authed: true }),
        ),
      () => ({
        event_id: eventId,
        kind: "standard",
        is_admin: false,
        entries: [],
        meta: {
          page: 1,
          limit: 50,
          total: 0,
          mode: params.mode ?? "all",
          completions_total: 0,
          progress_total: 0,
        },
      }),
    );
  },


  /** Event-scoped manager audit log: merged ledger + admin actions. Admin only. */
  async eventAudit(eventId: number, params: EventAuditParams = {}): Promise<EventAudit> {
    const p = new URLSearchParams();
    if (params.page) p.set("page", String(params.page));
    if (params.limit) p.set("limit", String(params.limit));
    if (params.category?.length) p.set("category", params.category.join(","));
    if (params.actorUserId) p.set("actor_user_id", String(params.actorUserId));
    if (params.playerId) p.set("player_id", String(params.playerId));
    if (params.teamId) p.set("team_id", String(params.teamId));
    if (params.taskId) p.set("task_id", String(params.taskId));
    if (params.sourceType) p.set("source_type", params.sourceType);
    if (params.hasProof) p.set("has_proof", "1");
    if (params.from) p.set("from", String(params.from));
    if (params.to) p.set("to", String(params.to));
    if (params.q) p.set("q", params.q);
    return withFallback(
      async () =>
        EventAuditSchema.parse(await apiGet(`/events/${eventId}/audit?${p}`, { authed: true })),
      () => ({
        event_id: eventId,
        entries: [],
        meta: { page: 1, limit: 50, total: 0, capped: false },
      }),
    );
  },


  /** Replace the tile layout (designer autosave). 409 once the event starts. */
  async saveEventBoard(eventId: number, input: BoardInput): Promise<BoardDetail> {
    return BoardDetailSchema.parse(await apiSend("PUT", `/events/${eventId}/board`, input));
  },


  /** Procedurally generate a whole board (art + sequential tile track) in one
   * shot. Draft-only. Returns the refreshed board (extra `generated` meta is
   * ignored by BoardDetailSchema). */
  async generateEventBoard(
    eventId: number,
    params: {
      seed?: number | null;
      regions?: number;
      tiles?: number;
      style?: "path" | "filled";
      title?: string;
      subtitle?: string;
      watermark?: string | null;
    },
  ): Promise<BoardDetail> {
    return BoardDetailSchema.parse(
      await apiSend("POST", `/events/${eventId}/board/generate`, params),
    );
  },


  /** Merge a partial board-settings document (live-tunable mid-event). */
  async patchEventBoardSettings(
    eventId: number,
    patch: Record<string, unknown>,
  ): Promise<BoardSettings> {
    const res = z
      .object({ settings: BoardSettingsSchema })
      .parse(await apiSend("PATCH", `/events/${eventId}/board/settings`, patch));
    return res.settings;
  },


  /** Upload the board background image (server-side B2 put). */
  async uploadEventBoardBackground(
    eventId: number,
    form: FormData,
  ): Promise<{ background_url: string; bg_width: number; bg_height: number }> {
    return z
      .object({
        background_url: z.string(),
        bg_width: z.number().int(),
        bg_height: z.number().int(),
      })
      .parse(await apiSendForm("POST", `/events/${eventId}/board/background`, form));
  },


  /** Upload a custom boss/category image for a Loot Sweep group; returns the
   * stored URL to put in the group's `image_url`. */
  async uploadLootSweepImage(eventId: number, form: FormData): Promise<{ url: string }> {
    return z
      .object({ url: z.string(), width: z.number().int(), height: z.number().int() })
      .parse(await apiSendForm("POST", `/events/${eventId}/loot-sweep/image`, form));
  },


  /** Manual dice roll for the caller's team (admins may pass a team_id). */
  async rollEventBoard(eventId: number, teamId?: number): Promise<BoardRollResult> {
    return BoardRollResultSchema.parse(
      await apiSend("POST", `/events/${eventId}/board/roll`, teamId ? { team_id: teamId } : {}),
    );
  },


  /** The event's shop catalog + (when on a team) wallet/inventory/cooldowns. */
  async eventBoardShop(eventId: number, teamId?: number): Promise<BoardShopState> {
    const qs = teamId != null ? `?team_id=${teamId}` : "";
    return BoardShopStateSchema.parse(
      await apiGet(`/events/${eventId}/board/shop${qs}`, { authed: true }),
    );
  },


  /** Buy a power-up with team coins. */
  async buyEventBoardItem(
    eventId: number,
    shopItemId: number,
    teamId?: number,
  ): Promise<{ team_id: number; inventory_id: number; coins: number }> {
    return z
      .object({ team_id: z.number().int(), inventory_id: z.number().int(), coins: z.number().int() })
      .parse(
        await apiSend("POST", `/events/${eventId}/board/shop/buy`, {
          shop_item_id: shopItemId,
          ...(teamId != null ? { team_id: teamId } : {}),
        }),
      );
  },


  /** Use an owned power-up (skip / reroll / boost…). `value` drives numeric
   * effects like choose_roll (Wizard's Mind Bomb); `targetTeamId` the offensive
   * ones (steal/reroll_opponent/knockback/freeze); `targetTileIdx` the roadblock
   * (optional — the backend defaults it to the team's current tile). */
  async useEventBoardItem(
    eventId: number,
    inventoryId: number,
    opts: {
      teamId?: number;
      targetTeamId?: number;
      targetTileIdx?: number;
      value?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    return (await apiSend("POST", `/events/${eventId}/board/items/${inventoryId}/use`, {
      ...(opts.teamId != null ? { team_id: opts.teamId } : {}),
      ...(opts.targetTeamId != null ? { target_team_id: opts.targetTeamId } : {}),
      ...(opts.targetTileIdx != null ? { target_tile_idx: opts.targetTileIdx } : {}),
      ...(opts.value != null ? { value: opts.value } : {}),
    })) as Record<string, unknown>;
  },


  /** Resolve a pending task choice (choose_task items — Cache of Runes). */
  async resolveEventBoardChoice(
    eventId: number,
    choiceIndex: number,
  ): Promise<Record<string, unknown>> {
    return (await apiSend("POST", `/events/${eventId}/board/choice`, {
      choice_index: choiceIndex,
    })) as Record<string, unknown>;
  },


  /** Per-event shop config: refresh cadence (mirrored from settings.shop) plus
   * a row per active catalog item with its overrides. */
  async eventBoardShopConfig(eventId: number): Promise<BoardShopConfig> {
    return BoardShopConfigSchema.parse(
      await apiGet(`/events/${eventId}/board/shop/config`, { authed: true }),
    );
  },


  /** Save the per-event shop config (per-item overrides). Refresh cadence is
   * saved separately through patchEventBoardSettings. */
  async putEventBoardShopConfig(
    eventId: number,
    payload: BoardShopConfigInput,
  ): Promise<BoardShopConfig> {
    return BoardShopConfigSchema.parse(
      await apiSend("PUT", `/events/${eventId}/board/shop/config`, payload),
    );
  },


  /** Superadmin: the site-wide power-up catalog. */
  async adminShopItems(): Promise<AdminShopItem[]> {
    return AdminShopItemSchema.array().parse(
      await apiGet(`/admin/boardgame-shop`, { authed: true }),
    );
  },


  /** Superadmin: edit one catalog row. */
  async adminPatchShopItem(
    itemId: number,
    patch: Record<string, unknown>,
  ): Promise<AdminShopItem> {
    return AdminShopItemSchema.parse(
      await apiSend("PATCH", `/admin/boardgame-shop/${itemId}`, patch),
    );
  },


  async addEventTeam(eventId: number, input: EventTeamInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/teams`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  async updateEventTeam(
    eventId: number,
    teamId: number,
    patch: EventTeamPatch,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/teams/${teamId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async deleteEventTeam(eventId: number, teamId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/teams/${teamId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Admin-only ledger read (verification queue + full history). */
  async eventCompletions(
    eventId: number,
    params: { status?: string; teamId?: number; taskId?: number } = {},
  ): Promise<EventCompletion[]> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.teamId) q.set("teamId", String(params.teamId));
    if (params.taskId) q.set("taskId", String(params.taskId));
    return withFallback(
      async () =>
        EventCompletionSchema.array().parse(
          await apiGet(`/events/${eventId}/completions?${q}`, { authed: true }),
        ),
      () => mockEventCompletions(eventId, params.status),
    );
  },


  async confirmEventCompletion(eventId: number, completionId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/completions/${completionId}/confirm`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Confirm many pending completions in one call; returns per-row outcomes. */
  async confirmEventCompletionsBulk(
    eventId: number,
    ids: number[],
  ): Promise<{ confirmed: number[]; skipped: { id: number; reason: string }[] }> {
    const schema = z.object({
      confirmed: z.number().array(),
      skipped: z.object({ id: z.number(), reason: z.string() }).array(),
    });
    return withFallback(
      async () =>
        schema.parse(
          await apiSend("POST", `/events/${eventId}/completions/confirm-bulk`, { ids }),
        ),
      () => ({ confirmed: ids, skipped: [] }),
    );
  },


  async rejectEventCompletion(
    eventId: number,
    completionId: number,
    note?: string,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          "POST",
          `/events/${eventId}/completions/${completionId}/reject`,
          note ? { note } : {},
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async awardEventCompletion(eventId: number, input: EventAwardInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/events/${eventId}/award`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  async revokeEventCompletion(eventId: number, input: EventRevokeInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/events/${eventId}/revoke`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
