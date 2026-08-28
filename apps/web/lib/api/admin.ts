import { z } from "zod";
import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminApiKeyListSchema,
  ApiKeySchema,
  ApiKeyTierSchema,
  ApiUsageWindowSchema,
  ApiKeyRevealResultSchema,
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
  type AdminApiKeyList,
  type ApiKey,
  type ApiKeyTier,
  type ApiUsageWindow,
  type ApiKeyRevealResult,
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


  // ── Data API (v2) keys ────────────────────────────────────────────────────

  /** Every key plus the tier definitions they resolve against. */
  async adminApiKeys(): Promise<AdminApiKeyList> {
    return withFallback(
      async () => AdminApiKeyListSchema.parse(await apiGet(`/admin/api-keys`, { authed: true })),
      () => ({ keys: [], tiers: [] }),
    );
  },

  /** Mint a key for a user or a group. The token is in the response ONCE. */
  async adminMintApiKey(input: {
    owner_user_id?: number | null;
    group_id?: number | null;
    /** "global" mints an all-access key and takes no owner. */
    scope?: "user" | "group" | "global";
    label?: string;
    tier?: string;
    notes?: string;
    /** Deliver as a one-time link DMed to the owner instead of showing it here. */
    deliver_link?: boolean;
    /** Required for a global key, which has no owner to deliver to. */
    deliver_to_user_id?: number | null;
  }): Promise<ApiKey> {
    return ApiKeySchema.parse(await apiSend("POST", `/admin/api-keys`, input));
  },

  /** Promote a tier, set or clear per-key overrides (null clears), revoke. */
  async adminUpdateApiKey(
    id: number,
    input: {
      tier?: string;
      label?: string;
      notes?: string;
      revoked?: boolean;
      requests_per_min?: number | null;
      cost_units_per_min?: number | null;
      requests_per_day?: number | null;
      max_concurrency?: number | null;
    },
  ): Promise<ApiKey> {
    return ApiKeySchema.parse(await apiSend("PATCH", `/admin/api-keys/${id}`, input));
  },

  /** Tier definitions, with how many live keys each is responsible for. */
  async adminApiKeyTiers(): Promise<ApiKeyTier[]> {
    return withFallback(
      async () =>
        ApiKeyTierSchema.array().parse(
          ((await apiGet(`/admin/api-key-tiers`, { authed: true })) as { tiers: unknown })
            .tiers,
        ),
      () => [],
    );
  },

  /** Create or update a tier. Its limits apply to every key on it at once. */
  async adminPutApiKeyTier(
    tierKey: string,
    input: {
      display_name?: string;
      requests_per_min?: number;
      cost_units_per_min?: number;
      requests_per_day?: number;
      max_concurrency?: number;
      enabled?: boolean;
      sort_order?: number;
    },
  ): Promise<ApiKeyTier> {
    return ApiKeyTierSchema.parse(await apiSend("PUT", `/admin/api-key-tiers/${tierKey}`, input));
  },

  /** Delete a tier. Refused by the backend while live keys still use it. */
  async adminDeleteApiKeyTier(tierKey: string): Promise<void> {
    await apiSend("DELETE", `/admin/api-key-tiers/${tierKey}`, {});
  },

  /**
   * Claim a one-time key link. Spends it — call once, from a page render.
   *
   * Returns a discriminated result rather than throwing, because "already
   * opened" and "not yours" are ordinary outcomes the page must explain, not
   * errors. `spent` distinguishes the one case where the holder should be
   * told the link was real.
   */
  async claimApiKeyReveal(token: string): Promise<
    | ({ ok: true } & ApiKeyRevealResult)
    | { ok: false; spent: boolean }
  > {
    try {
      const raw = await apiSend("GET", `/api-key-reveals/${encodeURIComponent(token)}`, {});
      return { ok: true as const, ...ApiKeyRevealResultSchema.parse(raw) };
    } catch (e) {
      const status = (e as { status?: number })?.status;
      return { ok: false as const, spent: status === 410 };
    }
  },

  /** Per-key spend, latency and errors over the last `hours`. */
  async adminApiUsage(hours = 24): Promise<ApiUsageWindow> {
    return withFallback(
      async () =>
        ApiUsageWindowSchema.parse(
          await apiGet(`/admin/api-usage?hours=${hours}`, { authed: true }),
        ),
      () => ({ available: false, hours, totals: {}, endpoints: {}, statuses: {}, keys: [] }),
    );
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
