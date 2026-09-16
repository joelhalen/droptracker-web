import { apiGet, apiSend, withFallback } from "./_client";
import {
  EmbedDefaultsResponseSchema,
  EventLayoutDefaultsResponseSchema,
  GroupEmbedSchema,
  GroupEmbedsResponseSchema,
  GroupNotificationLayoutsResponseSchema,
  NotificationLayoutDefaultsResponseSchema,
  NotificationLayoutMetaSchema,
  SavedNotificationLayoutSchema,
  EventLayoutMetaSchema,
  EventLayoutsResponseSchema,
  EventMessageLayoutSchema,
  GroupEventLayoutsResponseSchema,
  type EmbedDefaultsResponse,
  type EventLayoutDefaultsResponse,
  type EventLayoutMeta,
  type EventLayoutsResponse,
  type EventMessageLayout,
  type EventMessageLayoutInput,
  type GroupEventLayoutsResponse,
  type EmbedType,
  type GroupEmbed,
  type GroupEmbedInput,
  type GroupEmbedsResponse,
  type GroupNotificationLayoutsResponse,
  type NotificationLayoutDefaultsResponse,
  type NotificationLayoutInput,
  type NotificationLayoutMeta,
  type SavedNotificationLayout,
} from "@droptracker/api-types";
import {
  mockEmbedDefaults,
  mockEventLayoutDefaults,
  mockGroupEmbeds,
  mockEventLayoutMeta,
  mockEventLayouts,
  mockGroupEventLayouts,
  mockNotificationLayoutDefaults,
  mockNotificationLayoutMeta,
  mockGroupNotificationLayouts,
} from "../mock-data";

/** Staff routes over the template group's designs (the ACP's Default embeds). */
const DEFAULTS = "/admin/notification-defaults";

export const layoutsApi = {

  // --- Custom Discord embeds (subscription-gated) ------------------------
  /** Per-type embed templates: the group's custom template + system default. */
  async groupEmbeds(groupId: number): Promise<GroupEmbedsResponse> {
    return withFallback(
      async () =>
        GroupEmbedsResponseSchema.parse(
          await apiGet(`/groups/${groupId}/embeds`, { authed: true }),
        ),
      () => mockGroupEmbeds(),
    );
  },


  /** Save (upsert) the group's template for one embed type. Requires the `custom_embeds` entitlement. */
  async saveGroupEmbed(
    groupId: number,
    embedType: EmbedType,
    input: GroupEmbedInput,
  ): Promise<GroupEmbed> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/groups/${groupId}/embeds/${embedType}`, input)) as {
          embed: unknown;
        };
        return GroupEmbedSchema.parse(res.embed);
      },
      () => GroupEmbedSchema.parse({ embed_type: embedType, ...input }),
    );
  },


  /** Remove the group's custom template for one type (reverts to the default). */
  async deleteGroupEmbed(groupId: number, embedType: EmbedType): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/groups/${groupId}/embeds/${embedType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  // --- Event message layouts (web66a, subscription-gated) ----------------
  /** Editor metadata: message types, token docs, limits, sample standings. */
  async eventLayoutMeta(): Promise<EventLayoutMeta> {
    return withFallback(
      async () => EventLayoutMetaSchema.parse(await apiGet(`/event-layouts/meta`, { authed: true })),
      () => mockEventLayoutMeta(),
    );
  },


  /** Per-type event message layouts: the group's custom layout + system default. */
  async groupEventLayouts(groupId: number): Promise<GroupEventLayoutsResponse> {
    return withFallback(
      async () =>
        GroupEventLayoutsResponseSchema.parse(
          await apiGet(`/groups/${groupId}/event-layouts`, { authed: true }),
        ),
      () => mockGroupEventLayouts(),
    );
  },


  /** Save the group's layout for one event message type. Requires `custom_embeds`. */
  async saveGroupEventLayout(
    groupId: number,
    messageType: string,
    input: EventMessageLayoutInput,
  ): Promise<EventMessageLayout> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/groups/${groupId}/event-layouts/${messageType}`, input)) as {
          layout: unknown;
        };
        return EventMessageLayoutSchema.parse(res.layout);
      },
      () =>
        EventMessageLayoutSchema.parse({
          message_type: messageType,
          accent_color: input.accent_color ?? null,
          blocks: input.blocks,
        }),
    );
  },


  /** Remove the group's layout for one type (reverts to the system default). */
  async deleteGroupEventLayout(groupId: number, messageType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/groups/${groupId}/event-layouts/${messageType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  /** One event's layout overrides + the effective (group-level) layouts. */
  async eventLayouts(eventId: number): Promise<EventLayoutsResponse> {
    return withFallback(
      async () =>
        EventLayoutsResponseSchema.parse(await apiGet(`/events/${eventId}/layouts`, { authed: true })),
      () => mockEventLayouts(),
    );
  },


  /** Save a one-event layout override. Requires the host group's `custom_embeds`. */
  async saveEventLayout(
    eventId: number,
    messageType: string,
    input: EventMessageLayoutInput,
  ): Promise<EventMessageLayout> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `/events/${eventId}/layouts/${messageType}`, input)) as {
          layout: unknown;
        };
        return EventMessageLayoutSchema.parse(res.layout);
      },
      () =>
        EventMessageLayoutSchema.parse({
          message_type: messageType,
          accent_color: input.accent_color ?? null,
          blocks: input.blocks,
        }),
    );
  },


  /** Remove a one-event override (reverts to the group's layout). */
  async deleteEventLayout(eventId: number, messageType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/events/${eventId}/layouts/${messageType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Notification component layouts (custom_embeds entitlement) --------
  /** Editor metadata: notification types, token docs, Discord limits. */
  async notificationLayoutMeta(): Promise<NotificationLayoutMeta> {
    return withFallback(
      async () =>
        NotificationLayoutMetaSchema.parse(
          await apiGet(`/notification-layouts/meta`, { authed: true }),
        ),
      () => mockNotificationLayoutMeta(),
    );
  },

  /** The group's authored layouts, which are live, and the shipped defaults.
   * `enabled` reports the entitlement gate rather than the call failing for a group
   * outside it. */
  async groupNotificationLayouts(groupId: number): Promise<GroupNotificationLayoutsResponse> {
    return withFallback(
      async () =>
        GroupNotificationLayoutsResponseSchema.parse(
          await apiGet(`/groups/${groupId}/notification-layouts`, { authed: true }),
        ),
      () => mockGroupNotificationLayouts(),
    );
  },

  /** Save one type's layout. `active` decides whether it is what members get. */
  async saveGroupNotificationLayout(
    groupId: number,
    notificationType: string,
    input: NotificationLayoutInput,
  ): Promise<SavedNotificationLayout> {
    return withFallback(
      async () =>
        SavedNotificationLayoutSchema.parse(
          await apiSend(
            "PUT",
            `/groups/${groupId}/notification-layouts/${notificationType}`,
            input,
          ),
        ),
      () =>
        SavedNotificationLayoutSchema.parse({
          notification_type: notificationType,
          layout: { accent_color: input.accent_color ?? null, blocks: input.blocks },
          active: Boolean(input.active),
        }),
    );
  },

  /** Delete one type's layout — that type sends its embed again. */
  async deleteGroupNotificationLayout(
    groupId: number,
    notificationType: string,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/groups/${groupId}/notification-layouts/${notificationType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  // --- Site-wide defaults (staff: /admin/embeds) --------------------------
  /** Group 1's embed templates, the code-built embeds behind the row-less
   * types, and how many groups keep their own. Superadmin. */
  async embedDefaults(): Promise<EmbedDefaultsResponse> {
    return withFallback(
      async () =>
        EmbedDefaultsResponseSchema.parse(await apiGet(`${DEFAULTS}/embeds`, { authed: true })),
      () => mockEmbedDefaults(),
    );
  },

  /** Save the default template for one embed type — every group without its
   * own is sent it. */
  async saveEmbedDefault(embedType: EmbedType, input: GroupEmbedInput): Promise<GroupEmbed> {
    return withFallback(
      async () => {
        const res = (await apiSend("PUT", `${DEFAULTS}/embeds/${embedType}`, input)) as {
          embed: unknown;
        };
        return GroupEmbedSchema.parse(res.embed);
      },
      () => GroupEmbedSchema.parse({ embed_type: embedType, ...input }),
    );
  },

  /** Remove a stored default — only for the types with a built-in embed. */
  async deleteEmbedDefault(embedType: EmbedType): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `${DEFAULTS}/embeds/${embedType}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** Group 1's event message layouts next to the code defaults. Superadmin. */
  async eventLayoutDefaults(): Promise<EventLayoutDefaultsResponse> {
    return withFallback(
      async () =>
        EventLayoutDefaultsResponseSchema.parse(
          await apiGet(`${DEFAULTS}/event-layouts`, { authed: true }),
        ),
      () => mockEventLayoutDefaults(),
    );
  },

  async saveEventLayoutDefault(
    messageType: string,
    input: EventMessageLayoutInput,
  ): Promise<EventMessageLayout> {
    return withFallback(
      async () => {
        const res = (await apiSend(
          "PUT",
          `${DEFAULTS}/event-layouts/${encodeURIComponent(messageType)}`,
          input,
        )) as { layout: unknown };
        return EventMessageLayoutSchema.parse(res.layout);
      },
      () =>
        EventMessageLayoutSchema.parse({
          message_type: messageType,
          accent_color: input.accent_color ?? null,
          blocks: input.blocks,
        }),
    );
  },

  /** Drop the stored default — the code default is sent again. */
  async deleteEventLayoutDefault(messageType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `${DEFAULTS}/event-layouts/${encodeURIComponent(messageType)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },

  /** The starting layouts groups copy into their components builder. Superadmin. */
  async notificationLayoutDefaults(): Promise<NotificationLayoutDefaultsResponse> {
    return withFallback(
      async () =>
        NotificationLayoutDefaultsResponseSchema.parse(
          await apiGet(`${DEFAULTS}/component-layouts`, { authed: true }),
        ),
      () => mockNotificationLayoutDefaults(),
    );
  },

  /** Save a starting layout. Never live: the backend stores it inactive. */
  async saveNotificationLayoutDefault(
    notificationType: string,
    input: NotificationLayoutInput,
  ): Promise<SavedNotificationLayout> {
    return withFallback(
      async () =>
        SavedNotificationLayoutSchema.parse(
          await apiSend(
            "PUT",
            `${DEFAULTS}/component-layouts/${encodeURIComponent(notificationType)}`,
            input,
          ),
        ),
      () =>
        SavedNotificationLayoutSchema.parse({
          notification_type: notificationType,
          layout: { accent_color: input.accent_color ?? null, blocks: input.blocks },
          active: false,
        }),
    );
  },

  async deleteNotificationLayoutDefault(notificationType: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend(
          "DELETE",
          `${DEFAULTS}/component-layouts/${encodeURIComponent(notificationType)}`,
          {},
        );
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
