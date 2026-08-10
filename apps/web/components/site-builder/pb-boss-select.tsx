"use client";

/**
 * Boss + team-size selector for the PB block (sites-v1).
 *
 * The old config was a single "boss NPC id" number field — authors had to
 * know raw ids and could only show one boss. This searches the group's own PB
 * boss index (only bosses the clan actually has times for) and lets each
 * chosen boss carry a team-size filter, since "our CoX 3-man times" is the
 * thing clans actually want to show.
 */
import { useEffect, useMemo, useState } from "react";
import type { PbBossSummary } from "@droptracker/api-types";

export type PbSelection = { npc_id: number; name?: string; team_sizes: string[] };

export function PbBossSelect({
  groupId,
  value,
  onChange,
  max = 8,
}: {
  groupId: number;
  value: PbSelection[];
  onChange: (next: PbSelection[]) => void;
  max?: number;
}) {
  const [index, setIndex] = useState<PbBossSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${groupId}/pb-bosses`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { bosses: PbBossSummary[] }) => {
        if (!cancelled) setIndex(d.bosses ?? []);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const chosen = useMemo(() => new Map(value.map((v) => [v.npc_id, v])), [value]);
  const matches = useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    const pool = q ? index.filter((b) => b.name.toLowerCase().includes(q)) : index;
    return pool.filter((b) => !chosen.has(b.npc_id)).slice(0, 8);
  }, [index, query, chosen]);

  function add(boss: PbBossSummary) {
    if (value.length >= max) return;
    onChange([...value, { npc_id: boss.npc_id, name: boss.name, team_sizes: [] }]);
    setQuery("");
  }

  function toggleSize(npcId: number, size: string) {
    onChange(
      value.map((v) =>
        v.npc_id === npcId
          ? {
              ...v,
              team_sizes: v.team_sizes.includes(size)
                ? v.team_sizes.filter((s) => s !== size)
                : [...v.team_sizes, size],
            }
          : v,
      ),
    );
  }

  if (error) {
    return (
      <p className="text-osrs-parchment-dark/70 text-xs">
        Couldn&apos;t load your clan&apos;s boss list. Save and reopen to retry.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-osrs-parchment-dark/80 mb-1 block text-sm">
          Bosses to show ({value.length}/{max})
        </span>
        {value.length === 0 && (
          <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
            None chosen — the block falls back to your most-contested boss.
          </p>
        )}
        <ul className="space-y-2">
          {value.map((sel) => {
            const boss = index?.find((b) => b.npc_id === sel.npc_id);
            const sizes = boss?.team_sizes ?? [];
            return (
              <li key={sel.npc_id} className="border-osrs-bronze/30 rounded-lg border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {boss?.name ?? sel.name ?? `NPC ${sel.npc_id}`}
                  </span>
                  <button
                    type="button"
                    className="text-osrs-red text-xs"
                    onClick={() => onChange(value.filter((v) => v.npc_id !== sel.npc_id))}
                  >
                    ✕
                  </button>
                </div>
                {sizes.length > 0 && (
                  <div className="mt-1.5">
                    <span className="text-osrs-parchment-dark/60 mb-1 block text-[11px]">
                      Team sizes {sel.team_sizes.length === 0 && "(all)"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sizes.map((size) => {
                        const on = sel.team_sizes.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggleSize(sel.npc_id, size)}
                            className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                              on
                                ? "bg-osrs-bronze text-osrs-parchment"
                                : "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:bg-osrs-bronze/25 border"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {value.length < max && (
        <div>
          <input
            className="border-osrs-bronze/50 bg-osrs-surface-2 text-osrs-parchment w-full rounded border px-2 py-1.5 text-sm"
            placeholder={index ? "Search your clan's bosses…" : "Loading bosses…"}
            value={query}
            disabled={!index}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="border-osrs-bronze/30 mt-1 max-h-48 overflow-y-auto rounded border">
              {matches.map((b) => (
                <li key={b.npc_id}>
                  <button
                    type="button"
                    onClick={() => add(b)}
                    className="hover:bg-osrs-bronze/25 flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs"
                  >
                    <span>{b.name}</span>
                    <span className="text-osrs-parchment-dark/50">
                      {b.player_count} player{b.player_count === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {index && query && matches.length === 0 && (
            <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
              No matching boss with recorded times.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
