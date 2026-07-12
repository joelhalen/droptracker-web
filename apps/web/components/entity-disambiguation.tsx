import type { Route } from "next";
import Link from "next/link";
import type { ResolveCandidate } from "@droptracker/api-types";
import type { EntityKind } from "@/lib/slug";
import { Card, NameTile } from "@/components/ui";

const KIND_LABEL: Record<EntityKind, string> = {
  groups: "groups",
  players: "players",
  npcs: "NPCs",
  items: "items",
};

/** One-line distinguishing detail per candidate (fields are kind-specific). */
function subtitle(c: ResolveCandidate): string | null {
  const bits: string[] = [];
  if (typeof c.member_count === "number") bits.push(`${c.member_count.toLocaleString()} members`);
  if (c.total_loot) bits.push(`${c.total_loot.value_formatted} this month`);
  if (typeof c.created_ts === "number") {
    bits.push(`created ${new Date(c.created_ts * 1000).toLocaleDateString()}`);
  }
  return bits.length ? bits.join(" · ") : null;
}

/**
 * Rendered when a nice-URL slug matches several entities (a group/player name
 * collision). Each candidate links to its guaranteed-unique id URL. NPC/item
 * duplicate names collapse to a primary id, so those never reach this page.
 */
export function EntityDisambiguation({
  kind,
  slug,
  candidates,
}: {
  kind: EntityKind;
  slug: string;
  candidates: ResolveCandidate[];
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-osrs-gold text-2xl font-bold">
          Multiple {KIND_LABEL[kind]} named “{slug}”
        </h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          More than one {KIND_LABEL[kind].replace(/s$/, "")} shares this name — pick the one you’re
          looking for.
        </p>
      </header>
      <Card padding="p-2">
        <ul className="divide-osrs-bronze/15 divide-y">
          {candidates.map((c) => {
            const sub = subtitle(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/${kind}/${c.id}` as Route}
                  className="hover:bg-osrs-bronze/10 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                >
                  {c.icon_url ? (
                    <img
                      src={c.icon_url}
                      alt=""
                      width={36}
                      height={36}
                      className="border-osrs-bronze/40 size-9 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <NameTile name={c.name} size="sm" flair={c.flair?.style} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    {sub && <div className="text-osrs-parchment-dark/60 truncate text-xs">{sub}</div>}
                  </div>
                  <span className="text-osrs-parchment-dark/40 shrink-0 text-xs tabular-nums">
                    #{c.id}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
