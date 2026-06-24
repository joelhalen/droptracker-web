"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createGroupEvent } from "@/app/(admin)/groups/[id]/events/actions";

/** Convert a datetime-local value to unix seconds (or null). */
const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);

export function EventCreateForm({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createGroupEvent(groupId, {
        name,
        description: description || undefined,
        starts_at: toUnix(startsAt),
        ends_at: toUnix(endsAt),
      });
      router.push(`/groups/${groupId}/events/${res.id}` as Route);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Event name"
        className={field}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className={field}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={field}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}
