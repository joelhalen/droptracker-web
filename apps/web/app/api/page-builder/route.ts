/**
 * BFF for the page builder (web137a): save the draft, publish, unpublish or
 * discard. A route rather than Server Actions so autosave never queues behind
 * another action on the page (see lib/page-layout/builder-ops.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { LAYOUT_SCOPES, PageLayoutSchema, type LayoutScope } from "@droptracker/api-types";
import { runBuilderOp, type BuilderOp } from "@/lib/page-layout/builder-ops";

export const dynamic = "force-dynamic";

const OPS: readonly BuilderOp[] = ["save", "publish", "unpublish", "discard"];

export async function POST(req: NextRequest) {
  let body: { op?: unknown; scope?: unknown; id?: unknown; layout?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }
  const op = body.op as BuilderOp;
  const scope = body.scope as LayoutScope;
  const id = Number(body.id);
  if (!OPS.includes(op) || !LAYOUT_SCOPES.includes(scope) || !Number.isSafeInteger(id)) {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }
  const layout = op === "save" ? PageLayoutSchema.safeParse(body.layout) : null;
  if (layout && !layout.success) {
    return NextResponse.json({ ok: false, error: "That layout is malformed." }, { status: 400 });
  }
  // Always 200 with a result: the builder shows `error` as written.
  return NextResponse.json(await runBuilderOp(op, scope, id, layout?.data));
}
