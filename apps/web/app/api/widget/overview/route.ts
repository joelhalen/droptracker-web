/**
 * Public, anonymous feed for the DropTracker Android home-screen widget.
 *
 * One small payload combining two public Web API reads: `/status` (intake +
 * webhook path health, throughput, active players, open known issues) and
 * `/platform/summary` (month loot total, tracked accounts, top bosses). Both
 * are already public on the homepage and in #status; this route puts them on a
 * reachable host in one round trip. Each half fails independently so a slow
 * summary rebuild never blanks the health half.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { upstreamGet } from "../../activity/_lib";

export const dynamic = "force-dynamic";

const ServiceSchema = z.object({
  status: z.string().default("unknown"),
  online: z.boolean().default(false),
  players_1h: z.number().default(0),
  processed: z
    .object({ "5m": z.number(), "30m": z.number(), "24h": z.number() })
    .partial()
    .default({}),
  queue_depth: z.number().nullish(),
  consumer_alive: z.boolean().nullish(),
});

const StatusSchema = z.object({
  services: z.object({
    api: ServiceSchema.nullish(),
    webhook: ServiceSchema.nullish(),
    players_5m: z.number().nullish(),
    generated_at: z.number().nullish(),
  }),
  categories: z
    .array(z.object({ issues: z.array(z.unknown()).default([]) }).passthrough())
    .default([]),
});

const SummarySchema = z.object({
  member_count: z.number().nullish(),
  partition: z.number().nullish(),
  monthly_loot: z.object({ value: z.number(), value_formatted: z.string() }).nullish(),
  top_bosses: z
    .array(
      z.object({
        name: z.string(),
        npc_id: z.number(),
        drops: z.number(),
        loot: z.object({ value_formatted: z.string() }),
      }),
    )
    .default([]),
});

function shapeService(s: z.infer<typeof ServiceSchema> | null | undefined) {
  if (!s) return null;
  return {
    status: s.status,
    online: s.online,
    players_1h: s.players_1h,
    processed_5m: s.processed["5m"] ?? 0,
    processed_30m: s.processed["30m"] ?? 0,
    processed_24h: s.processed["24h"] ?? 0,
    queue_depth: s.queue_depth ?? null,
    consumer_alive: s.consumer_alive ?? null,
  };
}

async function loadStatus() {
  const s = StatusSchema.parse(await upstreamGet("/status", { revalidate: 30 }));
  return {
    api: shapeService(s.services.api),
    webhook: shapeService(s.services.webhook),
    players_5m: s.services.players_5m ?? null,
    open_issues: s.categories.reduce((n, c) => n + c.issues.length, 0),
    snapshot_at: s.services.generated_at ?? null,
  };
}

async function loadUsage() {
  const s = SummarySchema.parse(await upstreamGet("/platform/summary", { revalidate: 60 }));
  return {
    monthly_loot: s.monthly_loot?.value ?? null,
    monthly_loot_formatted: s.monthly_loot?.value_formatted ?? null,
    accounts: s.member_count ?? null,
    partition: s.partition ?? null,
    top_bosses: s.top_bosses.slice(0, 5).map((b) => ({
      name: b.name,
      npc_id: b.npc_id,
      drops: b.drops,
      loot_formatted: b.loot.value_formatted,
    })),
  };
}

export async function GET() {
  const [status, usage] = await Promise.allSettled([loadStatus(), loadUsage()]);
  if (status.status === "rejected") console.error("[widget/overview] status", status.reason);
  if (usage.status === "rejected") console.error("[widget/overview] usage", usage.reason);

  const body = {
    generated_at: Math.floor(Date.now() / 1000),
    status: status.status === "fulfilled" ? status.value : null,
    usage: usage.status === "fulfilled" ? usage.value : null,
  };
  const ok = body.status != null || body.usage != null;
  return NextResponse.json(body, {
    status: ok ? 200 : 502,
    headers: { "cache-control": "public, max-age=30" },
  });
}
