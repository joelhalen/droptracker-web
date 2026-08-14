import { z } from "zod";
import { apiGet, apiSend, withFallback } from "./_client";
import {
  EMPTY_STATUS_SUMMARY,
  KnownIssueCategorySchema,
  KnownIssueSchema,
  StatusSummarySchema,
  type KnownIssue,
  type KnownIssueCategory,
  type KnownIssueCategoryInput,
  type KnownIssueInput,
  type StatusSummary,
} from "../known-issues";

export const statusApi = {

  // --- Service status + known issues (drives the #status Discord cards) --
  async statusSummary(): Promise<StatusSummary> {
    return withFallback(
      async () => StatusSummarySchema.parse(await apiGet(`/status`)),
      () => EMPTY_STATUS_SUMMARY,
    );
  },


  async adminStatusIssues(): Promise<KnownIssueCategory[]> {
    return withFallback(
      async () =>
        z
          .object({ categories: KnownIssueCategorySchema.array() })
          .parse(await apiGet(`/admin/status/issues`, { authed: true })).categories,
      () => [],
    );
  },


  async adminCreateStatusCategory(input: KnownIssueCategoryInput): Promise<KnownIssueCategory> {
    return KnownIssueCategorySchema.parse(await apiSend("POST", `/admin/status/categories`, input));
  },


  async adminUpdateStatusCategory(
    id: number,
    patch: Partial<KnownIssueCategoryInput>,
  ): Promise<KnownIssueCategory> {
    return KnownIssueCategorySchema.parse(
      await apiSend("PATCH", `/admin/status/categories/${id}`, patch),
    );
  },


  async adminDeleteStatusCategory(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/status/categories/${id}`, {});
    return { ok: true } as const;
  },


  async adminCreateStatusIssue(input: KnownIssueInput): Promise<KnownIssue> {
    return KnownIssueSchema.parse(await apiSend("POST", `/admin/status/issues`, input));
  },


  async adminUpdateStatusIssue(id: number, patch: Partial<KnownIssueInput>): Promise<KnownIssue> {
    return KnownIssueSchema.parse(await apiSend("PATCH", `/admin/status/issues/${id}`, patch));
  },


  async adminDeleteStatusIssue(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/status/issues/${id}`, {});
    return { ok: true } as const;
  },
};
