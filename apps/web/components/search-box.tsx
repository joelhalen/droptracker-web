"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players and clans…"
        aria-label="Search"
        className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold flex-1 rounded border px-3 py-2 text-sm outline-none"
      />
      <button
        type="submit"
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
      >
        Search
      </button>
    </form>
  );
}
