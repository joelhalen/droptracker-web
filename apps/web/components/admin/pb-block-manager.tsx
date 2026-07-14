"use client";

import { useState, useTransition } from "react";
import type { PbBlockBoss, PbBlockList, PbBlockSearchResult } from "@droptracker/api-types";
import { Alert } from "@/components/ui";
import { addBlock, removeBlock, searchBosses } from "@/app/(site)/(admin)/admin/personal-bests/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

const idLabel = (ids: number[]) => (ids.length === 1 ? `id ${ids[0]}` : `${ids.length} ids`);

function dedupeByName(list: PbBlockBoss[]): PbBlockBoss[] {
  const seen = new Map<string, PbBlockBoss>();
  for (const b of list) seen.set(b.name.toLowerCase(), b);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function PbBlockManager({ initial }: { initial: PbBlockList }) {
  const [bosses, setBosses] = useState<PbBlockBoss[]>(initial.bosses);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PbBlockSearchResult[] | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PbBlockSearchResult | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const onSearch = () =>
    startTransition(async () => {
      setMessage(null);
      setResults(await searchBosses(query));
    });

  const onConfirmAdd = () => {
    const target = confirmTarget;
    if (!target) return;
    startTransition(async () => {
      const res = await addBlock(target.npc_ids, true);
      if ("error" in res && res.error) {
        setMessage({ ok: false, text: res.error });
      } else {
        // Optimistic: the boss is now blocked and purged (0 rows remaining).
        const added: PbBlockBoss[] = (
          res.bosses?.length
            ? res.bosses
            : [{ name: target.name, npc_ids: target.npc_ids, pb_count: 0 }]
        ).map((b) => ({ ...b, pb_count: 0 }));
        setBosses((cur) => dedupeByName([...cur, ...added]));
        setResults(
          (cur) => cur?.filter((r) => r.name.toLowerCase() !== target.name.toLowerCase()) ?? null,
        );
        setMessage({
          ok: true,
          text: `Blocked ${target.name} — permanently deleted ${res.deleted} personal-best row(s).`,
        });
      }
      setConfirmTarget(null);
    });
  };

  const onRemove = (boss: PbBlockBoss) => {
    const npcId = boss.npc_ids[0];
    if (npcId === undefined) return;
    startTransition(async () => {
      setMessage(null);
      const res = await removeBlock(npcId);
      if ("error" in res && res.error) {
        setMessage({ ok: false, text: res.error });
      } else {
        setBosses((cur) => cur.filter((b) => b.name.toLowerCase() !== boss.name.toLowerCase()));
        setMessage({ ok: true, text: `Unblocked ${boss.name}. Previously deleted rows are not restored.` });
      }
    });
  };

  return (
    <div className="space-y-8">
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <section className="space-y-3">
        <h2 className="text-osrs-gold text-lg font-semibold">Blocked NPCs ({bosses.length})</h2>
        <ul className="divide-osrs-bronze/20 divide-y">
          {bosses.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <span className="text-osrs-parchment font-medium">{b.name}</span>
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                  {idLabel(b.npc_ids)}
                  {b.pb_count > 0 && <span className="text-osrs-red"> · {b.pb_count} rows remain</span>}
                </span>
              </div>
              <button
                onClick={() => onRemove(b)}
                disabled={pending}
                className="text-osrs-gold-bright text-sm hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
          {!bosses.length && (
            <li className="text-osrs-parchment-dark/60 py-3 text-sm">No NPCs are blocked yet.</li>
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-osrs-gold text-lg font-semibold">Block an NPC</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search bosses by name…"
            className={field}
          />
          <button
            onClick={onSearch}
            disabled={pending || !query.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {results && (
          <ul className="border-osrs-bronze/20 divide-osrs-bronze/20 divide-y rounded border">
            {results.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="text-osrs-parchment font-medium">{r.name}</span>
                  <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                    {idLabel(r.npc_ids)} ·{" "}
                    <span className={r.pb_count > 0 ? "text-osrs-red" : ""}>{r.pb_count} PB rows</span>
                  </span>
                </span>
                {r.blocked ? (
                  <span className="text-osrs-parchment-dark/50 text-xs">Already blocked</span>
                ) : (
                  <button
                    onClick={() => {
                      setMessage(null);
                      setConfirmTarget(r);
                    }}
                    disabled={pending}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1 disabled:opacity-50"
                  >
                    Block…
                  </button>
                )}
              </li>
            ))}
            {!results.length && (
              <li className="text-osrs-parchment-dark/60 px-3 py-2 text-sm">No matches.</li>
            )}
          </ul>
        )}
      </section>

      {confirmTarget && (
        <ConfirmBlockModal
          target={confirmTarget}
          pending={pending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={onConfirmAdd}
        />
      )}
    </div>
  );
}

function ConfirmBlockModal({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: PbBlockSearchResult;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === target.name.toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-osrs-brown-dark border-osrs-red/40 w-full max-w-md rounded border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-osrs-red text-lg font-semibold">Block {target.name}?</h3>
        <p className="text-osrs-parchment-dark/80 mt-3 text-sm">
          This permanently deletes{" "}
          <strong className="text-osrs-parchment">
            {target.pb_count} personal-best row(s)
          </strong>{" "}
          for {target.name} (
          {target.npc_ids.length === 1
            ? `id ${target.npc_ids[0]}`
            : `ids ${target.npc_ids.join(", ")}`}
          ) and blocks all future submissions. <strong>This cannot be undone.</strong>
        </p>
        <label className="mt-4 block">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
            Type <span className="text-osrs-parchment font-semibold">{target.name}</span> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches && !pending && onConfirm()}
            className={field}
          />
        </label>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={pending}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || pending}
            className="bg-osrs-red/80 hover:bg-osrs-red text-osrs-parchment rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Deleting…" : `Delete ${target.pb_count} row(s) & block`}
          </button>
        </div>
      </div>
    </div>
  );
}
