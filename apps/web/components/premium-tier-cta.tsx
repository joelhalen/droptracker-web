"use client";

/**
 * Per-tier CTA for the public premium page. The page itself stays static/ISR,
 * so auth state comes from `/api/me` on mount — the same island pattern as
 * site-header.tsx — with one fetch shared across all tier cards.
 *
 *  - Signed out            → Discord sign-in (returning to /premium)
 *  - No adminable group    → create-a-group wizard
 *  - Admins exactly one    → deep-link to that group's subscription page,
 *                            carrying the tier so it's highlighted on arrival
 *  - Admins several groups → dashboard, to pick which group to upgrade
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { Me } from "@droptracker/api-types";

/** Module-level promise so N tier cards share a single /api/me request. */
let mePromise: Promise<Me | null> | null = null;
function fetchMe(): Promise<Me | null> {
  mePromise ??= fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null);
  return mePromise;
}

const CTA_CLASS =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-5 block truncate rounded px-3 py-2 text-center text-sm font-medium transition-colors";

export function PremiumTierCta({ tierKey }: { tierKey: string }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    fetchMe().then((data) => active && setMe(data));
    return () => {
      active = false;
    };
  }, []);

  if (me === undefined) {
    return <span className="bg-osrs-bronze/20 mt-5 block h-9 animate-pulse rounded" aria-hidden />;
  }

  if (!me) {
    // `prefetch={false}`: /api/auth/login is a mutating GET (it issues the
    // OAuth state cookie), so it must not be fired by Link prefetch.
    return (
      <Link
        href={"/api/auth/login?redirect=%2Fpremium" as Route}
        prefetch={false}
        className={CTA_CLASS}
      >
        Sign in to upgrade
      </Link>
    );
  }

  const adminGroups = me.groups.filter((g) => g.role === "owner" || g.role === "admin");
  if (adminGroups.length === 1) {
    const group = adminGroups[0]!;
    return (
      <Link
        href={`/groups/${group.id}/subscription?tier=${encodeURIComponent(tierKey)}` as Route}
        className={CTA_CLASS}
      >
        Upgrade {group.name}
      </Link>
    );
  }
  if (adminGroups.length > 1) {
    return (
      <Link href="/dashboard" className={CTA_CLASS}>
        Choose a group to upgrade
      </Link>
    );
  }
  return (
    <Link href="/groups/new" className={CTA_CLASS}>
      Create a group
    </Link>
  );
}
