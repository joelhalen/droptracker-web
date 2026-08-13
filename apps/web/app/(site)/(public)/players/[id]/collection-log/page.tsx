/**
 * A player's collection log, drawn as the in-game interface rather than a flat
 * grid of icons: a titled window, filled slots in colour and the rest dimmed.
 *
 * The caveat this page has to communicate honestly: `slots` is what the game
 * reports the player has filled, while `items_known` is how many we can
 * actually show. Until they open their collection log once — which triggers a
 * full read — we only know about items that dropped while the plugin was
 * running, so the two differ and the page says so rather than looking broken.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState } from "@/components/ui";
import { OsrsItemSlot, OsrsWindow, completionTone } from "@/components/osrs-panel";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) return { title: "Collection log" };
  try {
    const player = await api.player(ref.id);
    return {
      title: `${player.name} — Collection log`,
      description: `Collection log progress for ${player.name}.`,
    };
  } catch {
    return { title: "Collection log" };
  }
}

export default async function CollectionLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) notFound();
  const playerId = ref.id;

  const player = await orNotFound(api.player(playerId));
  const log = await api.playerCollectionLog(playerId).catch(() => null);

  if (!log || !log.has_synced) {
    return (
      <div className="space-y-6">
        <Header name={player.name} playerId={playerId} />
        <EmptyState
          title="No collection log yet"
          hint={`${player.name} has not synced their account progress. Enabling "Sync account progress" in the DropTracker plugin, then opening the collection log in game, records it here.`}
        />
      </div>
    );
  }

  const filled = log.slots ?? log.items_known;
  const total = log.slots_total ?? 0;
  const percent = total > 0 ? Math.round((filled / total) * 100) : null;
  const partial = log.slots != null && log.items_known < log.slots;

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <OsrsWindow
        title="Collection Log"
        subtitle={
          <span className={completionTone(filled, total)}>
            {total > 0
              ? `${filled.toLocaleString()}/${total.toLocaleString()}${percent != null ? ` (${percent}%)` : ""}`
              : filled.toLocaleString()}
          </span>
        }
      >
        {partial && (
          <p className="border-osrs-bronze/20 text-osrs-parchment-dark/80 border-b px-3 py-2 text-xs">
            Showing {log.items_known.toLocaleString()} of {filled.toLocaleString()} filled
            slots. The rest were obtained before tracking started — opening the collection log
            in game records the full list.
          </p>
        )}

        {log.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nothing recorded yet"
              hint="Open the collection log in game once and it will be captured here."
            />
          </div>
        ) : (
          <div className="max-h-[38rem] overflow-y-auto p-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1.5">
              {log.items.map((item) => (
                <OsrsItemSlot
                  key={item.item_id}
                  obtained
                  title={`${item.name}${item.quantity > 1 ? ` x${item.quantity.toLocaleString()}` : ""}`}
                >
                  <ItemDbIcon itemId={item.item_id} size={36} />
                  {item.quantity > 1 && (
                    <span
                      className="text-osrs-gold-bright font-osrs absolute top-0 left-0.5 text-[11px] leading-none"
                      style={{ textShadow: "1px 1px 0 #000" }}
                    >
                      {item.quantity > 99_999
                        ? `${Math.floor(item.quantity / 1000)}K`
                        : item.quantity}
                    </span>
                  )}
                </OsrsItemSlot>
              ))}
            </div>
          </div>
        )}
      </OsrsWindow>

      <p className="text-osrs-parchment-dark/50 text-xs">
        Grouping by collection log page needs the game&apos;s page structure, which is not
        tracked yet — every recorded slot is shown together for now.
      </p>
    </div>
  );
}

function Header({ name, playerId }: { name: string; playerId: number }) {
  return (
    <div>
      <Link
        href={`/players/${playerId}`}
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm transition-colors"
      >
        ← {name}
      </Link>
      <h1 className="heading-rule mt-1 text-2xl font-bold">Collection log</h1>
    </div>
  );
}
