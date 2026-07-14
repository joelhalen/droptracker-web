"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import { isExternalDestination, type Redirect, type RedirectInput } from "@/lib/redirects";

/** Invalidate the middleware's cached rule set (tag) + this admin page. Because
 * the tag is revalidated, a redirect edit is live on the next request. */
function revalidateRedirects() {
  revalidateTag("redirects");
  revalidatePath("/admin/redirects");
}

/** Cheap shape checks for a create/patch. The path-to-regexp pattern itself is
 * validated in the browser (`isValidSource`) before submit, and the middleware
 * safely ignores an unparseable pattern — so the engine is deliberately not
 * imported here (keeps `path-to-regexp` out of the node server bundle).
 * `source`/`destination` are only checked when present (patches may omit them). */
function validate(patch: Partial<Pick<RedirectInput, "source" | "destination">>) {
  const { source, destination } = patch;
  if (source !== undefined) {
    if (!source.startsWith("/")) throw new Error("Source must be a path starting with '/'.");
  }
  if (destination !== undefined) {
    const d = destination.trim();
    if (!(d.startsWith("/") || isExternalDestination(d))) {
      throw new Error("Destination must be an internal path ('/…') or an http(s):// URL.");
    }
  }
  if (source !== undefined && destination !== undefined && source === destination.trim()) {
    throw new Error("Source and destination must differ.");
  }
}

export async function createRedirect(input: RedirectInput): Promise<Redirect> {
  await requireSuperadmin("/admin/redirects");
  validate(input);
  const created = await api.adminCreateRedirect(input);
  revalidateRedirects();
  return created;
}

export async function updateRedirect(id: number, patch: Partial<RedirectInput>): Promise<Redirect> {
  await requireSuperadmin("/admin/redirects");
  validate(patch);
  const updated = await api.adminUpdateRedirect(id, patch);
  revalidateRedirects();
  return updated;
}

export async function deleteRedirect(id: number): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/redirects");
  const result = await api.adminDeleteRedirect(id);
  revalidateRedirects();
  return result;
}
