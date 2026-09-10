import { apiGet, apiSend, withFallback } from "./_client";
import {
  EventClanPointsSchema,
  type EventClanPoints,
  type EventClanPointsConfigInput,
} from "@droptracker/api-types";

/** An empty read — what an event with no clan-point payout returns. */
function emptyClanPoints(eventId: number): EventClanPoints {
  return { event_id: eventId, status: "draft", kind: "standard", scopes: [] };
}

export const eventPointsApi = {
  // --- Clan-point awards (web114a) -----------------------------------------
  /** Each clan's payout for the event. Public read: the offer and, once paid,
   * who got what. `preview` adds the admin-only projection to the scopes the
   * viewer manages; `groupId` narrows to one clan. */
  async eventClanPoints(
    eventId: number,
    opts: { groupId?: number | null; preview?: boolean } = {},
  ): Promise<EventClanPoints> {
    const params = new URLSearchParams();
    if (opts.groupId != null) params.set("group_id", String(opts.groupId));
    if (opts.preview) params.set("preview", "1");
    const qs = params.size ? `?${params}` : "";
    return withFallback(
      async () =>
        EventClanPointsSchema.parse(
          await apiGet(`/events/${eventId}/clan-points${qs}`, { authed: true }),
        ),
      () => emptyClanPoints(eventId),
    );
  },

  /** Save (a subset of) one clan's payout config. */
  async updateEventClanPoints(
    eventId: number,
    groupId: number,
    config: EventClanPointsConfigInput,
  ): Promise<EventClanPoints> {
    return EventClanPointsSchema.parse(
      await apiSend("PUT", `/events/${eventId}/clan-points`, { group_id: groupId, config }),
    );
  },

  /** Award — or re-sync an existing award to the current standings. */
  async awardEventClanPoints(eventId: number, groupId: number): Promise<EventClanPoints> {
    return EventClanPointsSchema.parse(
      await apiSend("POST", `/events/${eventId}/clan-points/award`, { group_id: groupId }),
    );
  },

  /** Take back every point the event paid this clan. */
  async revokeEventClanPoints(eventId: number, groupId: number): Promise<EventClanPoints> {
    return EventClanPointsSchema.parse(
      await apiSend("POST", `/events/${eventId}/clan-points/revoke`, {
        group_id: groupId,
        confirm: "REVOKE",
      }),
    );
  },
};
