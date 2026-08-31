import { apiGet, apiSend, withFallback } from "./_client";
import {
  EventMetaEntrySchema,
  AiTaskQuotaSchema,
  type AiTaskQuota,
  EventCaCatalogSchema,
  EventPetCategorySchema,
  type EventCaCatalog,
  type EventPetCategory,
  EventItemSourcesSchema,
  type EventItemSources,
  EventTaskLibraryItemSchema,
  EventTaskLibraryPageSchema,
  type EventTaskLibraryPage,
  BulkLibraryTasksResultSchema,
  type BulkLibraryTasksInput,
  type BulkLibraryTasksResult,
  EventTemplateSummarySchema,
  type EventTemplateSummary,
  EventTemplateDetailSchema,
  type EventTemplateDetail,
  type EventTemplateSaveInput,
  type EventTemplateInstantiateInput,
  EventTemplateInstantiateResultSchema,
  type EventTemplateInstantiateResult,
  type EventTemplatePatch,
  type EventTaskInput,
  type EventMetaEntry,
  type EventTaskLibraryItem,
  type EventTaskLibraryItemInput,
  type EventTaskLibraryItemPatch,
  type EventTaskPatch,
} from "@droptracker/api-types";
import {
  mockEventTaskLibrary,
  mockEventTemplates,
  mockEventTemplateDetail,
} from "../mock-data";

export const eventTasksApi = {

  /** Curated task presets for the designer picker (any group admin). */
  async eventTaskLibrary(
    params: { query?: string; type?: string; difficulty?: string; page?: number } = {},
  ): Promise<EventTaskLibraryItem[]> {
    const q = new URLSearchParams();
    if (params.query) q.set("query", params.query);
    if (params.type) q.set("type", params.type);
    if (params.difficulty) q.set("difficulty", params.difficulty);
    if (params.page) q.set("page", String(params.page));
    return withFallback(
      async () =>
        EventTaskLibraryItemSchema.array().parse(
          await apiGet(`/event-task-library?${q}`, { authed: true }),
        ),
      () => mockEventTaskLibrary(params.query, params.type, params.difficulty),
    );
  },

  /** Same read, plus the per-tier availability counts the bulk-preload panel
   * needs ("12 easy / 30 medium / …"). Separate method rather than a flag so
   * the plain list keeps its bare-array contract. */
  async eventTaskLibraryPage(
    params: { query?: string; type?: string; difficulty?: string; page?: number } = {},
  ): Promise<EventTaskLibraryPage> {
    const q = new URLSearchParams({ envelope: "1" });
    if (params.query) q.set("query", params.query);
    if (params.type) q.set("type", params.type);
    if (params.difficulty) q.set("difficulty", params.difficulty);
    if (params.page) q.set("page", String(params.page));
    return withFallback(
      async () =>
        EventTaskLibraryPageSchema.parse(
          await apiGet(`/event-task-library?${q}`, { authed: true }),
        ),
      () => ({
        items: mockEventTaskLibrary(params.query, params.type, params.difficulty),
        difficulty_counts: { air: 0, water: 0, earth: 0, fire: 0 },
        untiered: 0,
      }),
    );
  },

  /** Copy many library presets into an event at once — explicit picks and/or
   * "N random presets of tier X". The board-game stocking path: filling four
   * difficulty pools one click at a time is why boards shipped under-stocked. */
  async addEventTasksFromLibrary(
    eventId: number,
    input: BulkLibraryTasksInput,
  ): Promise<BulkLibraryTasksResult> {
    return withFallback(
      async () =>
        BulkLibraryTasksResultSchema.parse(
          await apiSend("POST", `/events/${eventId}/tasks/from-library`, input),
        ),
      () => ({ created: [], skipped: [] }),
    );
  },


  // --- Task-library management (superadmin CP) ------------------------------
  /** Create a curated site-wide preset (source "curated", group_id null). */
  async adminCreateEventTaskLibraryItem(
    input: EventTaskLibraryItemInput,
  ): Promise<EventTaskLibraryItem> {
    return withFallback(
      async () =>
        EventTaskLibraryItemSchema.parse(await apiSend("POST", `/event-task-library`, input)),
      () => ({
        id: Math.floor(Math.random() * 100000),
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        target: input.target ?? null,
        target_value: input.target_value ?? null,
        default_points: input.default_points ?? 0,
        difficulty: input.difficulty ?? null,
        config: input.config ?? null,
        source: "curated",
        group_id: null,
        visibility: input.visibility ?? "public",
      }),
    );
  },


  /** Edit any preset (curated or group-saved); absent keys stay unchanged. */
  async adminUpdateEventTaskLibraryItem(
    itemId: number,
    patch: EventTaskLibraryItemPatch,
  ): Promise<EventTaskLibraryItem> {
    return EventTaskLibraryItemSchema.parse(
      await apiSend("PATCH", `/event-task-library/${itemId}`, patch),
    );
  },


  /** Soft-delete a preset (tasks already copied into events are untouched). */
  async adminDeleteEventTaskLibraryItem(itemId: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/event-task-library/${itemId}`, {});
    return { ok: true } as const;
  },


  // --- Event templates (save/rerun events) ----------------------------------
  /** Snapshot an event's structure as a reusable template (any lifecycle
   * state). Upserts per owning group by lower-cased name. */
  async saveEventTemplate(eventId: number, input: EventTemplateSaveInput): Promise<{ id: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/events/${eventId}/save-template`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  /** Templates visible to the caller: public ∪ own groups' private rows.
   * `groupId` narrows to that group's own templates (management view). */
  async eventTemplates(
    params: { query?: string; groupId?: number; page?: number } = {},
  ): Promise<EventTemplateSummary[]> {
    const q = new URLSearchParams();
    if (params.query) q.set("query", params.query);
    if (params.groupId != null) q.set("groupId", String(params.groupId));
    if (params.page) q.set("page", String(params.page));
    return withFallback(
      async () =>
        EventTemplateSummarySchema.array().parse(
          await apiGet(`/event-templates?${q}`, { authed: true }),
        ),
      () => mockEventTemplates(params.query),
    );
  },


  /** Template detail + preview (task list, team names) for the picker. */
  async eventTemplate(templateId: number): Promise<EventTemplateDetail> {
    return withFallback(
      async () =>
        EventTemplateDetailSchema.parse(
          await apiGet(`/event-templates/${templateId}`, { authed: true }),
        ),
      () => mockEventTemplateDetail(templateId),
    );
  },


  /** Create a fresh draft event from a template. Tasks that no longer
   * validate come back in `skipped_tasks` (their cells survive unbound). */
  async instantiateEventTemplate(
    templateId: number,
    input: EventTemplateInstantiateInput,
  ): Promise<EventTemplateInstantiateResult> {
    return withFallback(
      async () =>
        EventTemplateInstantiateResultSchema.parse(
          await apiSend("POST", `/event-templates/${templateId}/instantiate`, input),
        ),
      () => ({ id: Math.floor(Math.random() * 100000), skipped_tasks: [] }),
    );
  },


  /** Rename / re-describe / re-scope a template. */
  async updateEventTemplate(templateId: number, patch: EventTemplatePatch): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/event-templates/${templateId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Soft-delete a template (instantiated events are untouched). */
  async deleteEventTemplate(templateId: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/event-templates/${templateId}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** Item-name autocomplete for the task form (exact in-game names). */
  async searchEventItems(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/items?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Remaining AI task generations for the caller in this group today.
   * Read-only; the task builder polls it to decide whether to offer the
   * "describe a task" panel at all. Falls back to a closed quota so a
   * backend hiccup hides the panel rather than offering a button that 429s. */
  async aiTaskQuota(groupId: number | null): Promise<AiTaskQuota> {
    const q = groupId == null ? "" : `?group_id=${groupId}`;
    return withFallback(
      async () => AiTaskQuotaSchema.parse(await apiGet(`/events/meta/ai-quota${q}`, { authed: true })),
      () => ({ limit: 0, used: 0, remaining: 0, allowed: false }),
    );
  },


  /** Charge one generation. Throws ApiError(429) with `code` when a cap is
   * hit — deliberately NOT wrapped in withFallback: silently "succeeding"
   * here would uncap the feature whenever the backend is unreachable. */
  async consumeAiTaskQuota(groupId: number | null): Promise<AiTaskQuota> {
    return AiTaskQuotaSchema.parse(
      await apiSend("POST", "/events/meta/ai-quota/consume", { group_id: groupId }),
    );
  },


  /** Hand a charge back after a failed generation. Best-effort. */
  async refundAiTaskQuota(groupId: number | null): Promise<void> {
    try {
      await apiSend("POST", "/events/meta/ai-quota/refund", { group_id: groupId });
    } catch {
      // A lost refund costs the group one generation; never surface it over
      // the real generation error the caller is already handling.
    }
  },


  /** Batch exact-name → game-id lookup (icon hydration for stored task
   * lists; names never contain pipes, so `|` is the separator). Unknown
   * names are simply absent from the response. */
  async resolveEventMeta(kind: "item" | "npc", names: string[]): Promise<EventMetaEntry[]> {
    if (!names.length) return [];
    const q = new URLSearchParams({ kind, names: names.slice(0, 100).join("|") });
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/resolve?${q}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** NPC-name autocomplete for the task form (exact in-game names). */
  async searchEventNpcs(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/npcs?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Pet-name autocomplete for the task form — names from the pet taxonomy
   * (guaranteed to validate as pets), ids from the item DB for icons. */
  async searchEventPets(query: string): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/pets?q=${encodeURIComponent(query)}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Full pet taxonomy (every category with its member pets) — backs the
   * task form's category presets for the customizable pet list. */
  async eventPetCategories(): Promise<EventPetCategory[]> {
    return withFallback(
      async () =>
        EventPetCategorySchema.array().parse(
          await apiGet(`/events/meta/pet-categories`, { authed: true }),
        ),
      () => [],
    );
  },


  /** Combat achievement catalogue (monsters + per-tier counts) — the
   * ca_target task builder's picker. */
  async eventCaCatalog(): Promise<EventCaCatalog> {
    return withFallback(
      async () =>
        EventCaCatalogSchema.parse(
          await apiGet(`/events/meta/ca-monsters`, { authed: true }),
        ),
      () => ({ tiers: [], monsters: [] }),
    );
  },


  /** Items on one NPC's drop table — the task form's "import a boss's drops"
   * helper (wiki table → boss-family fallback → observed tracked drops). */
  async eventNpcDropItems(npcId: number): Promise<EventMetaEntry[]> {
    return withFallback(
      async () =>
        EventMetaEntrySchema.array().parse(
          await apiGet(`/events/meta/npc-drops?npc_id=${npcId}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** NPC drop sources for one or more items — backs the task-form
   * "restrict to specific NPC sources" picker (names are |-separated exact
   * in-game names, no pipes). Unresolved names are simply absent. */
  async itemSources(names: string[]): Promise<EventItemSources> {
    if (!names.length) return [];
    const q = new URLSearchParams({ items: names.slice(0, 50).join("|") });
    return withFallback(
      async () =>
        EventItemSourcesSchema.parse(
          await apiGet(`/events/meta/item-sources?${q}`, { authed: true }),
        ),
      () => [],
    );
  },


  /** `visibility` echoes what the library actually stored — a "public" save
   * whose requirements duplicate an existing public preset comes back
   * "private" (group-only). */
  async addEventTask(
    eventId: number,
    input: EventTaskInput,
  ): Promise<{ id: number; visibility?: "public" | "private" }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/events/${eventId}/tasks`, input)) as {
          id: number;
          visibility?: "public" | "private";
        },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  async deleteEventTask(
    eventId: number,
    taskId: number,
    /** web68a: "keep_scores" lets teams keep points the task already granted
     * (active events); default = full unwind ("revoke"). */
    retro?: "revoke" | "keep_scores",
  ): Promise<{ ok: true }> {
    const q = retro ? `?retro=${retro}` : "";
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/tasks/${taskId}${q}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Event verification queue & manual actions (Task 18) -----------------
  async updateEventTask(
    eventId: number,
    taskId: number,
    patch: EventTaskPatch,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/events/${eventId}/tasks/${taskId}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
