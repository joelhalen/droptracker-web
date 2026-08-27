import { z } from "zod";
import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminLookupResponseSchema,
  PbBlockListSchema,
  PbBlockSearchResponseSchema,
  PbBlockMutationSchema,
  AdminEventTypeSchema,
  type AdminEventType,
  AdminEventRateLimitSchema,
  type AdminEventRateLimit,
  ServiceLogsSchema,
  ServiceStatusSchema,
  BackupOverviewSchema,
  type BackupOverview,
  B2UsageSchema,
  type B2Usage,
  BackupOffsiteSchema,
  type BackupOffsite,
  type AdminLookupResponse,
  type PbBlockList,
  type PbBlockSearchResponse,
  type PbBlockMutation,
  type DiscordSendInput,
  type ServiceAction,
  type ServiceLogs,
  type ServiceStatus,
  type SubscriptionTierInput,
} from "@droptracker/api-types";
import {
  mockLookup,
  mockB2Usage,
  mockBackupOffsite,
  mockBackupOverview,
  mockServiceLogs,
  mockServices,
} from "../mock-data";

/**
 * State of the edge Worker's dev-mirror switch. `expires_at` is the auto-expiry:
 * null means it runs until someone turns it off.
 */
const EdgeMirrorStateSchema = z.object({
  enabled: z.boolean(),
  sample: z.number(),
  expires_at: z.string().nullable(),
});
export type EdgeMirrorState = z.infer<typeof EdgeMirrorStateSchema>;

export const adminApi = {

  /** Whether seasonal-world (Leagues/DMM) submission processing is globally on. */
  async seasonalStatus(): Promise<{ active: boolean }> {
    return withFallback(
      async () =>
        z.object({ active: z.boolean() }).parse(await apiGet(`/seasonal-status`)),
      () => ({ active: true }),
    );
  },


  // --- Superadmin --------------------------------------------------------
  /** Current state of the global seasonal-processing kill switch. */
  async adminSeasonal(): Promise<{ active: boolean }> {
    return withFallback(
      async () =>
        z.object({ active: z.boolean() }).parse(await apiGet(`/admin/seasonal`, { authed: true })),
      () => ({ active: true }),
    );
  },


  /** Toggle seasonal-world submission processing globally. */
  async adminSetSeasonal(active: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/seasonal`, { active });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /**
   * Whether the Cloudflare edge Worker is also mirroring production submissions
   * at the dev instance, and when that lapses.
   */
  async adminEdgeMirror(): Promise<EdgeMirrorState> {
    return withFallback(
      async () =>
        EdgeMirrorStateSchema.parse(await apiGet(`/admin/edge-mirror`, { authed: true })),
      () => ({ enabled: false, sample: 1, expires_at: null }),
    );
  },


  /**
   * Start or stop mirroring. `ttlSeconds` null means no expiry — everything
   * else self-disables, which is the point.
   */
  async adminSetEdgeMirror(enabled: boolean, ttlSeconds: number | null): Promise<EdgeMirrorState> {
    return withFallback(
      async () =>
        EdgeMirrorStateSchema.parse(
          await apiSend("POST", `/admin/edge-mirror`, { enabled, ttl_seconds: ttlSeconds }),
        ),
      () => ({ enabled, sample: 1, expires_at: null }),
    );
  },


  // --- Event types (web43a) ----------------------------------------------
  /** The site-wide event-type registry with per-kind test-group allowlists. */
  async adminEventTypes(): Promise<AdminEventType[]> {
    return withFallback(
      async () =>
        AdminEventTypeSchema.array().parse(
          await apiGet(`/admin/event-types`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Toggle a kind's enabled / admin_only flags; returns the updated row. */
  async adminPatchEventType(
    key: string,
    patch: { enabled?: boolean; admin_only?: boolean },
  ): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend("PATCH", `/admin/event-types/${encodeURIComponent(key)}`, patch),
    );
  },


  /** Add a group to a kind's test allowlist; returns the updated row. */
  async adminAddEventTypeTestGroup(key: string, groupId: number): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend("POST", `/admin/event-types/${encodeURIComponent(key)}/test-groups`, {
        group_id: groupId,
      }),
    );
  },


  /** Remove a group from a kind's test allowlist; returns the updated row. */
  async adminRemoveEventTypeTestGroup(key: string, groupId: number): Promise<AdminEventType> {
    return AdminEventTypeSchema.parse(
      await apiSend(
        "DELETE",
        `/admin/event-types/${encodeURIComponent(key)}/test-groups/${groupId}`,
        {},
      ),
    );
  },


  // --- Event rate limits (web65a) ----------------------------------------
  /** Every configured per-tier event frequency cap. */
  async adminEventRateLimits(): Promise<AdminEventRateLimit[]> {
    return withFallback(
      async () =>
        AdminEventRateLimitSchema.array().parse(
          await apiGet(`/admin/event-rate-limits`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Upsert one cap, keyed by (tier_key, type_key); returns the stored row. */
  async adminPutEventRateLimit(input: {
    tier_key: string;
    type_key: string;
    max_events: number;
    window_days: number;
    enabled?: boolean;
  }): Promise<AdminEventRateLimit> {
    return AdminEventRateLimitSchema.parse(
      await apiSend("PUT", `/admin/event-rate-limits`, input),
    );
  },


  /** Delete one cap (that scope reverts to unlimited). */
  async adminDeleteEventRateLimit(id: number): Promise<void> {
    await apiSend("DELETE", `/admin/event-rate-limits/${id}`, {});
  },


  async adminServices(): Promise<ServiceStatus[]> {
    return withFallback(
      async () =>
        ServiceStatusSchema.array().parse(await apiGet(`/admin/services`, { authed: true })),
      () => mockServices(),
    );
  },


  async adminServiceAction(
    unit: string,
    action: ServiceAction["action"],
    confirm = false,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/services/${encodeURIComponent(unit)}`, { action, confirm });
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminServiceLogs(unit: string, lines = 200): Promise<ServiceLogs> {
    return withFallback(
      async () =>
        ServiceLogsSchema.parse(
          await apiGet(
            `/admin/services/${encodeURIComponent(unit)}/logs?lines=${encodeURIComponent(lines)}`,
            { authed: true },
          ),
        ),
      () => mockServiceLogs(unit),
    );
  },


  async adminBackups(): Promise<BackupOverview> {
    return withFallback(
      async () => BackupOverviewSchema.parse(await apiGet(`/admin/backups`, { authed: true })),
      () => mockBackupOverview(),
    );
  },


  async adminBackupLogs(): Promise<ServiceLogs> {
    return withFallback(
      async () => ServiceLogsSchema.parse(await apiGet(`/admin/backups/logs`, { authed: true })),
      () => mockServiceLogs("droptracker-db-backup"),
    );
  },


  async adminBackupOffsite(): Promise<BackupOffsite> {
    return withFallback(
      async () =>
        BackupOffsiteSchema.parse(await apiGet(`/admin/backups/offsite`, { authed: true })),
      () => mockBackupOffsite(),
    );
  },


  async adminRunBackup(): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/backups/run`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminB2Usage(): Promise<B2Usage> {
    return withFallback(
      async () => B2UsageSchema.parse(await apiGet(`/admin/b2/usage`, { authed: true })),
      () => mockB2Usage(),
    );
  },


  async adminSendDiscord(input: DiscordSendInput): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("POST", `/admin/discord/send`, input);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminLookup(q: string): Promise<AdminLookupResponse> {
    if (!q.trim()) return { results: [] };
    return withFallback(
      async () =>
        AdminLookupResponseSchema.parse(
          await apiGet(`/admin/lookup?q=${encodeURIComponent(q)}`, { authed: true }),
        ),
      () => mockLookup(q),
    );
  },


  // --- Personal-best NPC blocklist ---------------------------------------
  async adminPbBlocks(): Promise<PbBlockList> {
    return withFallback(
      async () => PbBlockListSchema.parse(await apiGet(`/admin/pb-blocks`, { authed: true })),
      () => ({ bosses: [], blocked_ids: [] }),
    );
  },


  async adminPbBlockSearch(q: string): Promise<PbBlockSearchResponse> {
    if (!q.trim()) return { results: [] };
    return withFallback(
      async () =>
        PbBlockSearchResponseSchema.parse(
          await apiGet(`/admin/pb-blocks/search?q=${encodeURIComponent(q)}`, { authed: true }),
        ),
      () => ({ results: [] }),
    );
  },


  /** Block a boss (its variant ids) and purge existing PB rows. `confirm` must
   * be true to actually delete — the backend returns 409 otherwise. */
  async adminAddPbBlock(npcIds: number[], confirm: boolean): Promise<PbBlockMutation> {
    return withFallback(
      async () =>
        PbBlockMutationSchema.parse(
          await apiSend("POST", `/admin/pb-blocks`, { npc_ids: npcIds, confirm }),
        ),
      () => ({ ok: true, blocked_ids: [], bosses: [] }),
    );
  },


  async adminRemovePbBlock(npcId: number): Promise<PbBlockMutation> {
    return withFallback(
      async () =>
        PbBlockMutationSchema.parse(await apiSend("DELETE", `/admin/pb-blocks/${npcId}`, {})),
      () => ({ ok: true, blocked_ids: [], bosses: [] }),
    );
  },


  async adminSaveTier(tier: SubscriptionTierInput, isNew: boolean): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          isNew ? "POST" : "PATCH",
          isNew
            ? `/admin/subscriptions/tiers`
            : `/admin/subscriptions/tiers/${encodeURIComponent(tier.key)}`,
          tier,
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminDeleteTier(key: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/subscriptions/tiers/${encodeURIComponent(key)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
