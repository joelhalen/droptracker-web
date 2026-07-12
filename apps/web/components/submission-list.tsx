import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { Submission } from "@droptracker/api-types";
import { formatRelativeTime } from "@/lib/format";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { Badge, EmptyState, type BadgeTone } from "@/components/ui";

const TYPE_META: Record<string, { label: string; tone: BadgeTone }> = {
  drop: { label: "Drop", tone: "gold" },
  clog: { label: "Collection log", tone: "purple" },
  pb: { label: "Personal best", tone: "sky" },
  ca: { label: "Combat achievement", tone: "red" },
  pet: { label: "Pet", tone: "ember" },
  level: { label: "Level", tone: "green" },
  quest: { label: "Quest", tone: "sky" },
};

/**
 * Detailed submission feed used on player and group profiles: item/NPC icon,
 * source NPC, relative time, and (group scope) who received it.
 */
export function SubmissionList({
  submissions,
  showPlayer = false,
  emptyTitle = "No recent submissions",
  emptyHint = "Tracked drops and achievements will appear here.",
}: {
  submissions: Submission[];
  /** Show the receiving player's name/link — group-scope listings only. */
  showPlayer?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (!submissions.length) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {submissions.map((s) => (
        <li key={`${s.type}-${s.id}`} className="flex items-center gap-3 py-2.5 text-sm">
          {s.image_url ? (
            <img src={s.image_url} alt="" className="size-8 shrink-0 object-contain" />
          ) : (
            <span className="bg-osrs-bronze/20 size-8 shrink-0 rounded" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Badge tone={TYPE_META[s.type]?.tone ?? "neutral"}>
                {TYPE_META[s.type]?.label ?? s.type}
              </Badge>
              {s.item_id ? (
                <Link
                  href={entityPath("items", s.item_id, s.label)}
                  className="hover:text-osrs-gold-bright truncate font-medium transition-colors"
                >
                  {s.label}
                </Link>
              ) : (
                <span className="truncate font-medium">{s.label}</span>
              )}
              {s.quantity != null && s.quantity > 1 && (
                <span className="text-osrs-parchment-dark/60 text-xs">×{s.quantity}</span>
              )}
            </div>
            <div className="text-osrs-parchment-dark/60 flex flex-wrap items-center gap-x-1.5 text-xs">
              {s.npc_name &&
                (s.npc_id ? (
                  <Link
                    href={entityPath("npcs", s.npc_id, s.npc_name)}
                    className="hover:text-osrs-gold-bright transition-colors"
                  >
                    {s.npc_name}
                  </Link>
                ) : (
                  <span>{s.npc_name}</span>
                ))}
              {s.npc_name && <span aria-hidden>·</span>}
              {showPlayer && s.player_name && (
                <>
                  {s.player_id ? (
                    <EntityHoverCard kind="player" id={s.player_id} name={s.player_name}>
                      <Link
                        href={entityPath("players", s.player_id, s.player_name)}
                        className="hover:text-osrs-gold-bright"
                      >
                        {s.player_name}
                      </Link>
                    </EntityHoverCard>
                  ) : (
                    <span>{s.player_name}</span>
                  )}
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{formatRelativeTime(s.ts)}</span>
            </div>
          </div>

          {s.value && (
            <span className="text-osrs-gold-bright shrink-0 tabular-nums">{s.value.value_formatted}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
