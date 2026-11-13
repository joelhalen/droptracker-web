import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminApiKeyRequestListSchema,
  ApiKeyRequestListSchema,
  ApiKeyRequestSchema,
  OwnedApiKeyListSchema,
  type AdminApiKeyRequestList,
  type ApiKeyRequest,
  type ApiKeyRequestList,
  type OwnedApiKeyList,
} from "@droptracker/api-types";

/**
 * Data API access (web163a): the keys a user or group holds, and asking for
 * one. A request opens a support ticket where staff approve or deny it; an
 * approved request carries a one-time claim link for the person who asked.
 * Backend: web_api/routes/api_keys.py, rules in db/api_key_requests.py.
 */
const EMPTY: ApiKeyRequestList = { requests: [], discord_member: null };

export const apiAccessApi = {
  async myApiKeys(): Promise<OwnedApiKeyList> {
    return withFallback(
      async () => OwnedApiKeyListSchema.parse(await apiGet(`/me/api-keys`, { authed: true })),
      () => ({ keys: [] }),
    );
  },

  async groupApiKeys(groupId: number): Promise<OwnedApiKeyList> {
    return withFallback(
      async () =>
        OwnedApiKeyListSchema.parse(await apiGet(`/groups/${groupId}/api-keys`, { authed: true })),
      () => ({ keys: [] }),
    );
  },

  async myApiKeyRequests(): Promise<ApiKeyRequestList> {
    return withFallback(
      async () =>
        ApiKeyRequestListSchema.parse(await apiGet(`/me/api-key-requests`, { authed: true })),
      () => EMPTY,
    );
  },

  async groupApiKeyRequests(groupId: number): Promise<ApiKeyRequestList> {
    return withFallback(
      async () =>
        ApiKeyRequestListSchema.parse(
          await apiGet(`/groups/${groupId}/api-key-requests`, { authed: true }),
        ),
      () => EMPTY,
    );
  },

  async requestMyApiKey(input: { label: string; purpose: string }): Promise<ApiKeyRequest> {
    return ApiKeyRequestSchema.parse(await apiSend("POST", `/me/api-key-requests`, input));
  },

  async requestGroupApiKey(
    groupId: number,
    input: { label: string; purpose: string },
  ): Promise<ApiKeyRequest> {
    return ApiKeyRequestSchema.parse(
      await apiSend("POST", `/groups/${groupId}/api-key-requests`, input),
    );
  },

  async cancelApiKeyRequest(requestId: number): Promise<ApiKeyRequest> {
    return ApiKeyRequestSchema.parse(
      await apiSend("POST", `/api-key-requests/${requestId}/cancel`, {}),
    );
  },

  async revokeMyApiKey(keyId: number): Promise<void> {
    await apiSend("DELETE", `/me/api-keys/${keyId}`, {});
  },

  async revokeGroupApiKey(groupId: number, keyId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/api-keys/${keyId}`, {});
  },

  async adminApiKeyRequests(): Promise<AdminApiKeyRequestList> {
    return withFallback(
      async () =>
        AdminApiKeyRequestListSchema.parse(
          await apiGet(`/admin/api-key-requests`, { authed: true }),
        ),
      () => ({ requests: [], pending: 0 }),
    );
  },

  async adminDecideApiKeyRequest(
    requestId: number,
    action: "approve" | "deny",
  ): Promise<ApiKeyRequest> {
    return ApiKeyRequestSchema.parse(
      await apiSend("POST", `/admin/api-key-requests/${requestId}/decision`, { action }),
    );
  },
};
