import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical } from "@/lib/seo";
import { RecentDropsList, TopPlayersList } from "@/components/entity-activity";
import { Card, EmptyState, StatTile } from "@/components/ui";
import { formatRarity } from "@/lib/format";

export const revalidate = 60;

type Params = Promise<{ itemId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ref = await resolveRef("item", (await params).itemId).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Item" };
  const item = await api.itemDetail(ref.id);
  if (!item) return { title: "Item" };
  const received = item.lifetime
    ? ` — received ${item.lifetime.drop_count.toLocaleString()} times (${item.lifetime.loot.value_formatted} GP) on DropTracker`
    : "";
  return {
    title: item.name,
    description: `${item.name}${received}. Recent receivers, top collectors, and drop sources.`,
    alternates: entityCanonical("items", item.item_id, item.canonical_slug),
  };
}

export default async function ItemPage({ params }: { params: Params }) {
  const ref = await resolveRef("item", (await params).itemId);
  // Item names collapse to a primary id, so `ambiguous` never happens here.
  if (ref.ambiguous) notFound();
  const itemId = ref.id;

  const item = await api.itemDetail(itemId);
  if (!item) notFound();

  const building = item.stats_status === "building";

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={item.icon_url}
            alt=""
            className="size-14 shrink-0 rounded object-contain"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-osrs-gold truncate text-2xl font-bold">{item.name}</h1>
            <p className="text-osrs-parchment-dark/70 text-sm">
              {item.ge_value ? (
                <>
                  GE value{" "}
                  <span className="text-osrs-green font-semibold">
                    {item.ge_value.value_formatted} gp
                  </span>
                  {" · "}
                </>
              ) : null}
              <a
                href={item.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-osrs-gold-bright hover:underline"
              >
                OSRS Wiki ↗
              </a>
            </p>
          </div>
        </div>
      </header>

      {building ? (
        <p className="text-osrs-parchment-dark/60 border-osrs-bronze/30 bg-osrs-surface-2/50 rounded border px-3 py-2 text-xs">
          Lifetime stats for this item are being computed — refresh in a minute.
        </p>
      ) : (
        item.lifetime && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Times received"
              value={item.lifetime.drop_count.toLocaleString()}
              hint="all time"
            />
            <StatTile
              label="Total value"
              value={item.lifetime.loot.value_formatted}
              hint={
                item.lifetime.quantity !== item.lifetime.drop_count
                  ? `${item.lifetime.quantity.toLocaleString()} total quantity`
                  : "all time"
              }
            />
            <StatTile
              label="Unique receivers"
              value={item.lifetime.unique_players.toLocaleString()}
              hint="all time"
            />
            <StatTile
              label="This month"
              value={item.month?.loot.value_formatted ?? "—"}
              hint={
                item.month
                  ? `${item.month.drop_count.toLocaleString()} drops · ${item.month.unique_players.toLocaleString()} players`
                  : undefined
              }
            />
          </div>
        )
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Recently received by</h2>
            <RecentDropsList
              rows={item.recent_drops.map((d) => ({
                drop_id: d.drop_id,
                player_id: d.player_id,
                player_name: d.player_name,
                value: d.value,
                quantity: d.quantity,
                ts: d.ts,
                context_id: d.npc_id,
                context_name: d.npc_name,
                context_href: "npcs" as const,
                icon_url: d.npc_icon_url,
              }))}
            />
          </Card>

          <Card>
            <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Dropped by</h2>
            {item.sources.npcs.length === 0 ? (
              <EmptyState
                title="No known drop sources"
                hint="This item isn't in any NPC drop table we track."
              />
            ) : (
              <>
                <ul className="divide-osrs-bronze/15 divide-y">
                  {item.sources.npcs.map((n) => (
                    <li key={n.npc_id} className="flex items-center gap-2.5 py-2 text-sm">
                      <img src={n.icon_url} alt="" className="size-7 shrink-0 object-contain" />
                      <Link
                        href={entityPath("npcs", n.npc_id, n.name)}
                        className="hover:text-osrs-gold-bright min-w-0 flex-1 truncate font-medium transition-colors"
                      >
                        {n.name}
                      </Link>
                      {n.quantity !== "1" && (
                        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
                          ×{n.quantity}
                        </span>
                      )}
                      <span
                        className="text-osrs-parchment-dark/80 shrink-0 text-sm tabular-nums"
                        title={
                          n.rarity < 1 ? `${(n.rarity * 100).toPrecision(3)}% per roll` : undefined
                        }
                      >
                        {formatRarity(n.rarity)}
                      </span>
                    </li>
                  ))}
                </ul>
                {item.sources.total > item.sources.npcs.length && (
                  <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
                    +{(item.sources.total - item.sources.npcs.length).toLocaleString()} more sources
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          <Card>
            <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Top receivers</h2>
            {building ? (
              <EmptyState title="Computing…" hint="Top receivers appear once stats finish building." />
            ) : (
              <TopPlayersList rows={item.top_receivers} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
