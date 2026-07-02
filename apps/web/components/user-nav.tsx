"use client";

/**
 * Auth-aware navigation island. Fetches `/api/me` on mount so the surrounding
 * server-rendered layout (and the public pages) can remain static while this
 * corner reflects sign-in state.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Me } from "@droptracker/api-types";

export function UserNav() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => active && setMe(data))
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, []);

  if (me === undefined) {
    return <span className="text-osrs-parchment-dark/40 text-sm">…</span>;
  }

  if (!me) {
    // `prefetch={false}`: /api/auth/login is a mutating GET (it issues the OAuth
    // state cookie), so it must not be fired by Link prefetch.
    return (
      <Link
        href="/api/auth/login"
        prefetch={false}
        className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 font-medium transition-colors"
      >
        Sign in with Discord
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {me.is_superadmin && (
        <Link href="/admin" className="text-osrs-red hover:text-osrs-gold-bright">
          Admin
        </Link>
      )}
      <Link href="/dashboard" className="hover:text-osrs-gold-bright">
        {me.display_name ?? "My account"}
      </Link>
      {/* Sign-out is a POST form, never a Link: a prefetchable GET logout gets
          fired by Next.js prefetch and silently clears the session. */}
      <form action="/api/auth/logout" method="post" className="inline">
        <button
          type="submit"
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright cursor-pointer"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
