import { apiGet, apiSend, withFallback, ApiError } from "./_client";
import { env } from "../env";
import {
  DocSchema,
  DocSummarySchema,
  type Doc,
  type DocInput,
  type DocSummary,
} from "@droptracker/api-types";

export const docsApi = {

  // --- Docs (CMS: superadmin-editable, replaces static .mdx files) -------
  async docs(): Promise<DocSummary[]> {
    return withFallback(
      async () => DocSummarySchema.array().parse(await apiGet(`/docs`, { revalidate: 60 })),
      () => [],
    );
  },


  async doc(slug: string): Promise<Doc | null> {
    try {
      return DocSchema.parse(await apiGet(`/docs/${encodeURIComponent(slug)}`, { revalidate: 60 }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      if (env.useMockApi) return null;
      throw err;
    }
  },


  async adminCreateDoc(input: DocInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/admin/docs`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  async adminUpdateDoc(slug: string, patch: Partial<DocInput>): Promise<Doc> {
    return withFallback(
      async () =>
        DocSchema.parse(await apiSend("PATCH", `/admin/docs/${encodeURIComponent(slug)}`, patch)),
      () => ({
        slug,
        title: patch.title ?? slug,
        description: patch.description ?? null,
        category: patch.category ?? "General",
        order: patch.order ?? 100,
        content: patch.content ?? "",
      }),
    );
  },


  async adminDeleteDoc(slug: string): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/docs/${encodeURIComponent(slug)}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
