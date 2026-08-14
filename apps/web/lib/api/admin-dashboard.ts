import { apiGet, apiSend, withFallback } from "./_client";
import { type AdminOverview, type AdminDataList, type AdminDataRecord, type AdminLogs, type AdminGroupOverview, type AdminAuditLog, type AdminUserOverview } from "./types";
import {
  GroupSubscriptionSchema,
  AdminSubscriptionsOverviewSchema,
  type GroupSubscription,
  type AdminSubscriptionsOverview,
} from "@droptracker/api-types";
import {
  mockAdminSubscriptionsOverview,
} from "../mock-data";

export const adminDashboardApi = {

  // --- Superadmin dashboard: overview -----------------------------------
  async adminOverview(): Promise<AdminOverview> {
    return withFallback(
      async () => (await apiGet(`/admin/overview`, { authed: true })) as AdminOverview,
      () => ({
        stats: [
          { key: "players", label: "Players", value: "—", hint: "API unavailable (mock mode)" },
          { key: "groups", label: "Groups", value: "—" },
          { key: "drops_24h", label: "Drops (24h)", value: "—" },
          { key: "queue", label: "Notification queue", value: "—" },
        ],
        generated_at: Math.floor(Date.now() / 1000),
      }),
    );
  },


  /** Monetization dashboard: MRR/lifetime KPIs, income by month, every
   * subscription (group legs + supporters), recent ledger payments. */
  async adminSubscriptionsOverview(): Promise<AdminSubscriptionsOverview> {
    return withFallback(
      async () =>
        AdminSubscriptionsOverviewSchema.parse(
          await apiGet(`/admin/subscriptions/overview`, { authed: true }),
        ),
      () => mockAdminSubscriptionsOverview(),
    );
  },


  // --- Superadmin dashboard: comped subscriptions -----------------------
  async adminGrantSubscription(
    groupId: number,
    tierKey: string,
    days: number,
  ): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/admin/groups/${groupId}/subscription/grant`, {
            tier_key: tierKey,
            days,
          }),
        ),
      () => ({
        group_id: groupId,
        tier_key: tierKey,
        status: "active" as const,
        provider: "manual" as const,
        current_period_end: Math.floor(Date.now() / 1000) + days * 86400,
        cancel_at_period_end: false,
      }),
    );
  },


  async adminRevokeSubscription(groupId: number): Promise<GroupSubscription> {
    return withFallback(
      async () =>
        GroupSubscriptionSchema.parse(
          await apiSend("POST", `/admin/groups/${groupId}/subscription/revoke`, {}),
        ),
      () => ({
        group_id: groupId,
        tier_key: null,
        status: "canceled" as const,
        provider: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    );
  },


  // --- Superadmin dashboard: whitelisted data viewer/editor -------------
  async adminDataList(
    entity: string,
    params: { q?: string; page?: number; limit?: number } = {},
  ): Promise<AdminDataList> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () =>
        (await apiGet(`/admin/data/${encodeURIComponent(entity)}${suffix}`, {
          authed: true,
        })) as AdminDataList,
      () => ({
        entity,
        columns: [],
        rows: [],
        editable: [],
        meta: { page: params.page ?? 1, limit: params.limit ?? 25, total: 0 },
      }),
    );
  },


  async adminDataRecord(entity: string, id: string | number): Promise<AdminDataRecord> {
    return withFallback(
      async () =>
        (await apiGet(
          `/admin/data/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`,
          {
            authed: true,
          },
        )) as AdminDataRecord,
      () => ({ entity, id, record: {}, editable: [] }),
    );
  },


  async adminDataUpdate(
    entity: string,
    id: string | number,
    fields: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          "PATCH",
          `/admin/data/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`,
          { fields },
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Superadmin dashboard: logs ---------------------------------------
  async adminLogs(params: { source?: string; limit?: number } = {}): Promise<AdminLogs> {
    const qs = new URLSearchParams();
    if (params.source) qs.set("source", params.source);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => (await apiGet(`/admin/logs${suffix}`, { authed: true })) as AdminLogs,
      () => ({ entries: [], sources: [] }),
    );
  },


  // --- Superadmin dashboard: group introspection ------------------------
  async adminGroupOverview(groupId: number): Promise<AdminGroupOverview> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/groups/${groupId}/overview`, { authed: true })) as AdminGroupOverview,
      () => ({
        group: {
          id: groupId,
          name: `Group #${groupId}`,
          member_count: 0,
          guild_id: null,
          wom_id: null,
        },
        subscription: null,
        config_summary: {},
        activity_7d: [],
        last_submission_ts: null,
        warnings: ["API unavailable (mock mode)."],
      }),
    );
  },


  // --- Superadmin dashboard: audit log -----------------------------------
  async adminAuditLog(
    params: {
      action?: string;
      actorUserId?: number;
      groupId?: number;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<AdminAuditLog> {
    const qs = new URLSearchParams();
    if (params.action) qs.set("action", params.action);
    if (params.actorUserId) qs.set("actor_user_id", String(params.actorUserId));
    if (params.groupId) qs.set("group_id", String(params.groupId));
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      async () => (await apiGet(`/admin/audit${suffix}`, { authed: true })) as AdminAuditLog,
      () => ({
        entries: [],
        meta: { page: params.page ?? 1, limit: params.limit ?? 50, total: 0 },
      }),
    );
  },


  // --- Superadmin dashboard: user moderation ------------------------------
  async adminUserOverview(userId: number): Promise<AdminUserOverview> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/users/${userId}/overview`, { authed: true })) as AdminUserOverview,
      () => ({
        user: {
          user_id: userId,
          discord_id: null,
          username: null,
          display_name: `User #${userId}`,
          avatar_url: null,
          is_superadmin: false,
          is_developer: false,
          public: true,
          hidden: false,
          date_added: null,
        },
        players: [],
        groups: [],
        recent_audit: [],
      }),
    );
  },


  async adminSetUserSuperadmin(userId: number, grant: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/users/${userId}/superadmin`, { grant });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Grant/revoke the developer flag (also awards/revokes the profile badge). */
  async adminSetUserDeveloper(userId: number, grant: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/users/${userId}/developer`, { grant });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
