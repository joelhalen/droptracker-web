"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({
  initial = "",
  basePath = "/search",
  placeholder = "Search players and clans…",
}: {
  initial?: string;
  basePath?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`${basePath}?q=${encodeURIComponent(q.trim())}` as Route);
      }}
      className="flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
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
