import { apiGet, apiSend, withFallback } from "./_client";
import {
  RedirectRuleSchema,
  RedirectSchema,
  type Redirect,
  type RedirectInput,
  type RedirectRule,
} from "../redirects";

export const redirectsApi = {

  // --- Redirects (admin-configurable, resolved at request time by middleware) --
  /** Enabled rules for the middleware read path (unauthed, cache-friendly). */
  async redirects(): Promise<RedirectRule[]> {
    return withFallback(
      async () => RedirectRuleSchema.array().parse(await apiGet(`/redirects`, { revalidate: 60 })),
      () => [],
    );
  },


  async adminRedirects(): Promise<Redirect[]> {
    return withFallback(
      async () => RedirectSchema.array().parse(await apiGet(`/admin/redirects`, { authed: true })),
      () => [],
    );
  },


  async adminCreateRedirect(input: RedirectInput): Promise<Redirect> {
    return RedirectSchema.parse(await apiSend("POST", `/admin/redirects`, input));
  },


  async adminUpdateRedirect(id: number, patch: Partial<RedirectInput>): Promise<Redirect> {
    return RedirectSchema.parse(await apiSend("PATCH", `/admin/redirects/${id}`, patch));
  },


  async adminDeleteRedirect(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/redirects/${id}`, {});
    return { ok: true } as const;
  },
};
