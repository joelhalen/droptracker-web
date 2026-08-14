import { apiGet, apiSend } from "./_client";
import {
  SiteResolveSchema,
  SitePagePayloadSchema,
  WomAchievementsPayloadSchema,
  type WomAchievementsPayload,
  SiteRosterPayloadSchema,
  type SiteRosterPayload,
  SiteAdminSchema,
  SiteMetaSchema,
  SitePageDetailSchema,
  SitePageSummarySchema,
  type SiteResolve,
  type SitePagePayload,
  type SiteAdmin,
  type SiteMeta,
  type SitePageDetail,
  type SitePageSummary,
} from "@droptracker/api-types";

export const sitesApi = {

  // --- sites-v1 builder (session-authed; dashboard only) --------------------

  async groupSite(
    groupId: number,
  ): Promise<{ site: SiteAdmin | null; tos_version: string; can_build: boolean }> {
    const raw = (await apiGet(`/groups/${groupId}/site`, { authed: true })) as {
      site: unknown;
      tos_version: string;
      can_build?: boolean;
    };
    return {
      site: raw.site ? SiteAdminSchema.parse(raw.site) : null,
      tos_version: raw.tos_version,
      can_build: Boolean(raw.can_build),
    };
  },


  async siteMeta(groupId: number): Promise<SiteMeta> {
    return SiteMetaSchema.parse(await apiGet(`/groups/${groupId}/site/meta`, { authed: true }));
  },


  async claimSite(groupId: number, subdomain: string): Promise<SiteAdmin> {
    const raw = (await apiSend("POST", `/groups/${groupId}/site/claim`, {
      subdomain,
      accept_tos: true,
    })) as { site: unknown };
    return SiteAdminSchema.parse(raw.site);
  },


  async updateSite(
    groupId: number,
    input: {
      theme_key?: string;
      palette?: Record<string, string>;
      nav?: Array<{ label: string; page_slug?: string; href?: string }>;
      custom_css_source?: string;
      roster_public?: boolean;
      mode?: string;
      redirect_url?: string;
    },
  ): Promise<SiteAdmin> {
    const raw = (await apiSend("PUT", `/groups/${groupId}/site`, input)) as { site: unknown };
    return SiteAdminSchema.parse(raw.site);
  },


  async createSitePage(groupId: number, slug: string, title: string): Promise<SitePageSummary> {
    const raw = (await apiSend("POST", `/groups/${groupId}/site/pages`, { slug, title })) as {
      page: unknown;
    };
    return SitePageSummarySchema.parse(raw.page);
  },


  async getSitePage(groupId: number, pageId: number): Promise<SitePageDetail> {
    const raw = (await apiGet(`/groups/${groupId}/site/pages/${pageId}`, { authed: true })) as {
      page: unknown;
    };
    return SitePageDetailSchema.parse(raw.page);
  },


  async updateSitePage(
    groupId: number,
    pageId: number,
    input: {
      title?: string;
      position?: number;
      blocks?: Array<Record<string, unknown>>;
      custom_css_source?: string;
    },
  ): Promise<SitePageDetail> {
    const raw = (await apiSend("PUT", `/groups/${groupId}/site/pages/${pageId}`, input)) as {
      page: unknown;
    };
    return SitePageDetailSchema.parse(raw.page);
  },


  async setSitePagePublished(
    groupId: number,
    pageId: number,
    publish: boolean,
  ): Promise<SitePageSummary> {
    const raw = (await apiSend(
      "POST",
      `/groups/${groupId}/site/pages/${pageId}/${publish ? "publish" : "unpublish"}`,
      {},
    )) as { page: unknown };
    return SitePageSummarySchema.parse(raw.page);
  },


  async setSitePublished(groupId: number, publish: boolean): Promise<SiteAdmin> {
    const raw = (await apiSend(
      "POST",
      `/groups/${groupId}/site/${publish ? "publish" : "unpublish"}`,
      {},
    )) as { site: unknown };
    return SiteAdminSchema.parse(raw.site);
  },


  async deleteSitePage(groupId: number, pageId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/site/pages/${pageId}`, {});
  },


  async deleteSite(groupId: number): Promise<void> {
    await apiSend("DELETE", `/groups/${groupId}/site`, {});
  },


  async sitePreviewToken(groupId: number): Promise<{ token: string; site_url: string }> {
    return (await apiSend("POST", `/groups/${groupId}/site/preview-token`, {})) as {
      token: string;
      site_url: string;
    };
  },


  /** Opt-in public member roster (sites-v1 member_roster block). */
  async siteRoster(
    groupId: number,
    limit = 25,
    sort: "monthly" | "all_time" | "name" = "monthly",
  ): Promise<SiteRosterPayload> {
    return SiteRosterPayloadSchema.parse(
      await apiGet(`/groups/${groupId}/site-roster?limit=${limit}&sort=${sort}`, {
        revalidate: 300,
      }),
    );
  },


  /** Recent WOM group achievements (sites-v1 wom_achievements block).
   *  Backend caches upstream 30 min; fails soft to an empty list. */
  async womAchievements(groupId: number, limit = 10): Promise<WomAchievementsPayload> {
    return WomAchievementsPayloadSchema.parse(
      await apiGet(`/groups/${groupId}/wom-achievements?limit=${limit}`, { revalidate: 300 }),
    );
  },


  /** Tenant mini-site shell for `{sub}.SITES_DOMAIN` (sites-v1). */
  async siteResolve(sub: string): Promise<SiteResolve> {
    return SiteResolveSchema.parse(
      await apiGet(`/sites/resolve?host=${encodeURIComponent(sub)}`, {
        revalidate: 60,
        tags: [`site:${sub}`],
      }),
    );
  },


  /** One tenant page's stored blocks. With a preview token the backend
   *  returns draft blocks; never cached (the token is single-purpose). */
  async sitePage(
    sub: string,
    slug: string,
    opts?: { previewToken?: string },
  ): Promise<SitePagePayload> {
    const qs = opts?.previewToken ? `?preview=${encodeURIComponent(opts.previewToken)}` : "";
    return SitePagePayloadSchema.parse(
      await apiGet(
        `/sites/${encodeURIComponent(sub)}/pages/${encodeURIComponent(slug)}${qs}`,
        opts?.previewToken ? {} : { revalidate: 60, tags: [`site:${sub}`] },
      ),
    );
  },
};
