"use client";
/** Browser half of the page builder's BFF calls (see app/api/page-builder). */
import type { LayoutScope, PageLayout } from "@droptracker/api-types";
import type { BuilderOp, BuilderResult } from "./builder-ops";

export async function builderOp(
  op: BuilderOp,
  scope: LayoutScope,
  id: number,
  layout?: PageLayout,
): Promise<BuilderResult> {
  try {
    const res = await fetch("/api/page-builder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, scope, id, layout }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Request failed (${res.status}).` };
    }
    return (await res.json()) as BuilderResult;
  } catch {
    return { ok: false, error: "Couldn't reach the server. Your change will save on the next edit." };
  }
}

export async function searchNpcs(q: string): Promise<{ id: number; name: string }[]> {
  try {
    const res = await fetch(`/api/page-builder/npcs?q=${encodeURIComponent(q)}`);
    return res.ok ? ((await res.json()) as { id: number; name: string }[]) : [];
  } catch {
    return [];
  }
}
