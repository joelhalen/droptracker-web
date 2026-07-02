"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { searchGroups } from "@/app/(admin)/admin/groups/actions";

export function GroupPicker({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<
    { id: number; name: string; member_count?: number }[] | null
  >(null);
  const [pending, startTransition] = useTransition();

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold flex-1 rounded border px-3 py-2 text-sm outline-none";

  const open = (groupId: number) =>
    router.push(`/admin/groups?groupId=${groupId}` as Route);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    // Numeric input → treat as a group id directly.
    if (/^\d+$/.test(trimmed)) {
      open(Number(trimmed));
      return;
    }
    startTransition(async () => {
      setResults(await searchGroups(trimmed));
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Group name or numeric ID…"
          aria-label="Find group"
          className={field}
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Searching…" : "Find"}
        </button>
      </form>

      {pending ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border px-3 py-2.5 text-sm">
          Searching…
        </div>
      ) : (
        results && (
          <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
            {results.length === 0 ? (
              <li className="text-osrs-parchment-dark/60 px-3 py-2.5 text-sm">
                No groups found.
              </li>
            ) : (
              results.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => open(g.id)}
                    className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
                  >
                    <span>
                      {g.name}
                      <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                        #{g.id}
                      </span>
                    </span>
                    {g.member_count != null && (
                      <span className="text-osrs-parchment-dark/60 text-xs">
                        {g.member_count} members
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )
      )}
    </div>
  );
}
