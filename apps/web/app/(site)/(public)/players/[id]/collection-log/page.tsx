/**
 * A player's collection log.
 *
 * Its own route rather than another section on the profile: it is a large grid
 * that most visitors do not want, and the profile page is already long.
 *
 * The honest caveat this page has to communicate: `slots` is what the game says
 * the player has filled, while `items_known` is how many we can actually show.
 * Until a player opens their collection log once (which triggers a full read),
 * we only know about items that dropped while the plugin was running, so the
 * two numbers differ and the page says so rather than looking broken.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { ItemDbIcon } from "@/components/item-db-icon";
import { Card, EmptyState, StatTile } from "@/components/ui";

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

  // The game's totals when we have them; otherwise fall back to what we hold,
  // so the page never shows a bare "null/null".
  const filled = log.slots ?? log.items_known;
  const total = log.slots_total;
  const percent = total && total > 0 ? Math.round((filled / total) * 100) : null;
  const partial = log.slots != null && log.items_known < log.slots;

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Slots filled"
          value={total ? `${filled.toLocaleString()} / ${total.toLocaleString()}` : filled.toLocaleString()}
        />
        <StatTile label="Completion" value={percent != null ? `${percent}%` : "—"} />
        <StatTile label="Items shown" value={log.items_known.toLocaleString()} />
      </div>

      {partial && (
        <Card padding="p-4">
          <p className="text-osrs-parchment-dark/80 text-sm">
            Showing {log.items_known.toLocaleString()} of {filled.toLocaleString()} filled slots.
            The rest were obtained before tracking started — opening the collection log in game
            records the full list.
          </p>
        </Card>
      )}

      {log.items.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          hint="Open the collection log in game once and it will be captured here."
        />
      ) : (
        <Card padding="p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
            {log.items.map((item) => (
              <div
                key={item.item_id}
                className="border-osrs-bronze/25 relative flex aspect-square items-center justify-center rounded border bg-black/25"
                title={`${item.name}${item.quantity > 1 ? ` x${item.quantity.toLocaleString()}` : ""}`}
              >
                <ItemDbIcon itemId={item.item_id} size={36} />
                {item.quantity > 1 && (
                  <span
                    className="text-osrs-gold-bright absolute top-0 left-0.5 font-mono text-[10px] leading-none"
                    style={{ textShadow: "1px 1px 0 #000" }}
                  >
                    {item.quantity > 99_999
                      ? `${Math.floor(item.quantity / 1000)}K`
                      : item.quantity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
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
