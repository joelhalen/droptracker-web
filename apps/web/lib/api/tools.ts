import { apiGet, apiSend } from "./_client";
import {
  ToolDirectorySchema,
  ToolListingSchema,
  type ToolDirectory,
  type ToolListing,
  type ToolListingInput,
} from "../tools-directory";

export const toolsApi = {
  // --- /tools directory (staff preview; staff + maintainers) -------------
  /** Throws ApiError 403 (`staff_required`) for anyone who is neither staff
   * nor a maintainer of some listing. No mock fallback: the page handles it. */
  async toolListings(): Promise<ToolDirectory> {
    return ToolDirectorySchema.parse(await apiGet(`/tools/listings`, { authed: true }));
  },

  async createToolListing(input: ToolListingInput): Promise<ToolListing> {
    return ToolListingSchema.parse(await apiSend("POST", `/tools/listings`, input));
  },

  async updateToolListing(id: number, patch: Partial<ToolListingInput>): Promise<ToolListing> {
    return ToolListingSchema.parse(await apiSend("PATCH", `/tools/listings/${id}`, patch));
  },

  async deleteToolListing(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/tools/listings/${id}`, {});
    return { ok: true } as const;
  },

  async addToolMaintainer(id: number, userId: number): Promise<ToolListing> {
    return ToolListingSchema.parse(
      await apiSend("POST", `/tools/listings/${id}/maintainers`, { user_id: userId }),
    );
  },

  async removeToolMaintainer(id: number, userId: number): Promise<ToolListing> {
    return ToolListingSchema.parse(
      await apiSend("DELETE", `/tools/listings/${id}/maintainers/${userId}`, {}),
    );
  },
};
