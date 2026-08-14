import { apiGet, apiSend, withFallback } from "./_client";
import {
  type ItemValueOverride,
  ItemValueOverrideSchema,
  type ItemValueOverrideInput,
  type ItemSearchResult,
  ItemSearchResultSchema,
  type PublicItemValue,
  PublicItemValueSchema,
} from "@droptracker/api-types";

export const itemValuesApi = {

  // --- Item value overrides (post-submission valuation rules) -----------
  async itemValues(): Promise<PublicItemValue[]> {
    return withFallback(
      async () =>
        PublicItemValueSchema.array().parse(await apiGet(`/item-values`, { revalidate: 120 })),
      () => [],
    );
  },


  async adminItemValues(): Promise<ItemValueOverride[]> {
    return withFallback(
      async () =>
        ItemValueOverrideSchema.array().parse(await apiGet(`/admin/item-values`, { authed: true })),
      () => [],
    );
  },


  async adminItemSearch(q: string): Promise<ItemSearchResult[]> {
    return withFallback(
      async () =>
        ItemSearchResultSchema.array().parse(
          await apiGet(`/admin/item-values/item-search?q=${encodeURIComponent(q)}`, {
            authed: true,
          }),
        ),
      () => [],
    );
  },


  async adminItemValuesExport(): Promise<{ txt: string; count: number }> {
    return withFallback(
      async () =>
        (await apiGet(`/admin/item-values/export`, { authed: true })) as {
          txt: string;
          count: number;
        },
      () => ({ txt: "", count: 0 }),
    );
  },


  async adminCreateItemValue(input: ItemValueOverrideInput): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/admin/item-values`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  async adminUpdateItemValue(
    id: number,
    patch: Partial<ItemValueOverrideInput>,
  ): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("PATCH", `/admin/item-values/${id}`, patch);
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },


  async adminDeleteItemValue(id: number): Promise<{ ok: true }> {
    return withFallback(
      async () => {
        await apiSend("DELETE", `/admin/item-values/${id}`, {});
        return { ok: true } as const;
      },
      () => ({ ok: true }) as const,
    );
  },
};
