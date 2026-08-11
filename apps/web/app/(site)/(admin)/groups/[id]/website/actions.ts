"use server";

/**
 * Server Actions for the group mini-site builder (sites-v1).
 *
 * Same contract as the embeds editor actions: return a discriminated result
 * instead of throwing (Next redacts thrown Server Action messages in
 * production and the builder needs the backend's real validation/entitlement
 * detail). Every action re-checks admin + entitlement; the Web API enforces
 * both again. Writes revalidate the tenant's cache tag so a publish shows up
 * on {sub}.SITES_DOMAIN promptly.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { ZodError } from "zod";
import type { SiteAdmin, SitePageDetail, SitePageSummary } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

export type SiteActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

async function guard(groupId: number, needEntitlement: boolean): Promise<string | null> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    return "Forbidden: you do not administer this group.";
  }
  if (needEntitlement && !user.is_superadmin) {
    const sub = await api.groupSubscription(groupId).catch(() => null);
    if (!hasEntitlement(sub, "custom_site")) {
      return "The custom website requires a higher subscription tier.";
    }
  }
  return null;
}

function revalidateSite(groupId: number, subdomain?: string) {
  revalidatePath(`/groups/${groupId}/website`);
  if (subdomain) revalidateTag(`site:${subdomain}`);
}

export async function claimSiteAction(
  groupId: number,
  subdomain: string,
): Promise<SiteActionResult<SiteAdmin>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const site = await api.claimSite(groupId, subdomain);
    revalidateSite(groupId, site.subdomain);
    return { ok: true, data: site };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function updateSiteAction(
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
): Promise<SiteActionResult<SiteAdmin>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const site = await api.updateSite(groupId, input);
    revalidateSite(groupId, site.subdomain);
    return { ok: true, data: site };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function createSitePageAction(
  groupId: number,
  slug: string,
  title: string,
): Promise<SiteActionResult<SitePageSummary>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const page = await api.createSitePage(groupId, slug, title);
    revalidateSite(groupId);
    return { ok: true, data: page };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function loadSitePageAction(
  groupId: number,
  pageId: number,
): Promise<SiteActionResult<SitePageDetail>> {
  try {
    const denied = await guard(groupId, false);
    if (denied) return { ok: false, error: denied };
    return { ok: true, data: await api.getSitePage(groupId, pageId) };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function saveSitePageAction(
  groupId: number,
  pageId: number,
  input: {
    title?: string;
    blocks?: Array<Record<string, unknown>>;
    custom_css_source?: string;
  },
): Promise<SiteActionResult<SitePageDetail>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const page = await api.updateSitePage(groupId, pageId, input);
    revalidateSite(groupId);
    return { ok: true, data: page };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function publishSitePageAction(
  groupId: number,
  pageId: number,
  publish: boolean,
  subdomain: string,
): Promise<SiteActionResult<SitePageSummary>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const page = await api.setSitePagePublished(groupId, pageId, publish);
    revalidateSite(groupId, subdomain);
    return { ok: true, data: page };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function publishSiteAction(
  groupId: number,
  publish: boolean,
): Promise<SiteActionResult<SiteAdmin>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    const site = await api.setSitePublished(groupId, publish);
    revalidateSite(groupId, site.subdomain);
    return { ok: true, data: site };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function deleteSitePageAction(
  groupId: number,
  pageId: number,
  subdomain: string,
): Promise<SiteActionResult<null>> {
  try {
    // No entitlement: downgraded groups can clean up (embeds DELETE precedent).
    const denied = await guard(groupId, false);
    if (denied) return { ok: false, error: denied };
    await api.deleteSitePage(groupId, pageId);
    revalidateSite(groupId, subdomain);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function deleteSiteAction(
  groupId: number,
  subdomain: string,
): Promise<SiteActionResult<null>> {
  try {
    const denied = await guard(groupId, false);
    if (denied) return { ok: false, error: denied };
    await api.deleteSite(groupId);
    revalidateSite(groupId, subdomain);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function sitePreviewTokenAction(
  groupId: number,
): Promise<SiteActionResult<{ token: string; site_url: string }>> {
  try {
    const denied = await guard(groupId, true);
    if (denied) return { ok: false, error: denied };
    return { ok: true, data: await api.sitePreviewToken(groupId) };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
