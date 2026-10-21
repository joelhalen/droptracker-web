import { apiGet, apiSend, withFallback } from "./_client";
import {
  DataRemovalRequestSchema,
  GroupDataRemovalSchema,
  MyDataRemovalsSchema,
  type DataRemovalRequest,
  type GroupDataRemoval,
  type MyDataRemovals,
} from "@droptracker/api-types";

/**
 * Self-serve data removal (web137a). Asking opens a support ticket where staff
 * verify ownership; nothing is erased until they approve and the 7-day grace
 * period ends. Backend: web_api/routes/data_removal.py.
 */
export const dataRemovalApi = {
  async myDataRemovals(): Promise<MyDataRemovals> {
    return withFallback(
      async () => MyDataRemovalsSchema.parse(await apiGet(`/me/data-removal`, { authed: true })),
      () => ({ requests: [] }),
    );
  },

  async requestPlayerRemoval(playerId: number, confirmName: string): Promise<DataRemovalRequest> {
    return DataRemovalRequestSchema.parse(
      await apiSend("POST", `/me/players/${playerId}/data-removal`, { confirm_name: confirmName }),
    );
  },

  async cancelDataRemoval(requestId: number): Promise<DataRemovalRequest> {
    return DataRemovalRequestSchema.parse(
      await apiSend("POST", `/me/data-removal/${requestId}/cancel`, {}),
    );
  },

  async groupDataRemoval(groupId: number): Promise<GroupDataRemoval> {
    return withFallback(
      async () =>
        GroupDataRemovalSchema.parse(
          await apiGet(`/groups/${groupId}/data-removal`, { authed: true }),
        ),
      () => ({ request: null, can_request: false }),
    );
  },

  async requestGroupRemoval(groupId: number, confirmName: string): Promise<DataRemovalRequest> {
    return DataRemovalRequestSchema.parse(
      await apiSend("POST", `/groups/${groupId}/data-removal`, { confirm_name: confirmName }),
    );
  },
};
