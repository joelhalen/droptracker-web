"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { GroupMember, WomSyncResult } from "@droptracker/api-types";
import { setHidden, syncWom } from "@/app/(admin)/groups/[id]/members/actions";

export function MembersManager({
  groupId,
  members,
  total,
}: {
  groupId: number;
  members: GroupMember[];
  total: number;
}) {
  const [rows, setRows] = useState(members);
  const [pending, startTransition] = useTransition();
  const [sync, setSync] = useState<WomSyncResult | null>(null);

  const onSync = () =>
    startTransition(async () => {
      setSync(await syncWom(groupId));
    });

  const onToggle = (playerId: number, hidden: boolean) => {
    setRows((prev) => prev.map((m) => (m.id === playerId ? { ...m, hidden } : m)));
    startTransition(async () => {
      await setHidden(groupId, playerId, hidden);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-osrs-parchment-dark/70 text-sm">{total} members</span>
        <div className="flex items-center gap-3">
          {sync && (
            <span className="text-osrs-green text-xs">
              Synced: +{sync.added} / −{sync.removed} ({sync.total} total)
            </span>
          )}
          <button
            onClick={onSync}
            disabled={pending}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Syncing…" : "Sync from WOM"}
          </button>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-osrs-gold/80 text-left">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Rank</th>
            <th className="px-3 py-2 text-right">Loot</th>
            <th className="px-3 py-2 text-right">Visibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-osrs-bronze/20 border-t">
              <td className="px-3 py-2">
                <Link href={`/players/${m.id}`} className="hover:text-osrs-gold-bright">
                  {m.name}
                </Link>
              </td>
              <td className="text-osrs-parchment-dark/70 px-3 py-2">{m.group_rank ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{m.total_loot?.value_formatted ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onToggle(m.id, !m.hidden)}
                  disabled={pending}
                  className={`rounded px-2 py-1 text-xs ${
                    m.hidden
                      ? "bg-osrs-red/20 text-osrs-red"
                      : "bg-osrs-green/20 text-osrs-green"
                  } disabled:opacity-50`}
                >
                  {m.hidden ? "Hidden" : "Visible"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
