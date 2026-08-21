import { apiGet, apiSend, withFallback } from "./_client";
import {
  GroupEmbedSchema,
  GroupEmbedsResponseSchema,
  GroupNotificationLayoutsResponseSchema,
  NotificationLayoutMetaSchema,
  SavedNotificationLayoutSchema,
  EventLayoutMetaSchema,
  EventLayoutsResponseSchema,
  EventMessageLayoutSchema,
  GroupEventLayoutsResponseSchema,
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
  type NotificationLayoutInput,
  type NotificationLayoutMeta,
  type SavedNotificationLayout,
} from "@droptracker/api-types";
import {
  mockGroupEmbeds,
  mockEventLayoutMeta,
  mockEventLayouts,
  mockGroupEventLayouts,
  mockNotificationLayoutMeta,
  mockGroupNotificationLayouts,
} from "../mock-data";

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

  // --- Notification component layouts (pilot-gated) ----------------------
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
   * `enabled` reports the pilot gate rather than the call failing for a group
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
};
