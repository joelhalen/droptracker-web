"use client";

/**
 * Client-side auth state: fetch `/api/me` once on mount (`undefined` while
 * loading, `null` when signed out). One module-level promise is shared across
 * every subscriber on the page, so N islands cost a single request.
 *
 * Consolidates the copies that had drifted into site-header.tsx and
 * premium-tier-cta.tsx (web57a).
 */
import { useEffect, useState } from "react";
import type { Me } from "@droptracker/api-types";

let mePromise: Promise<Me | null> | null = null;

function fetchMe(): Promise<Me | null> {
  mePromise ??= fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me | null>) : null))
    .catch(() => null);
  return mePromise;
}

export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    fetchMe().then((data) => active && setMe(data));
    return () => {
      active = false;
    };
  }, []);
  return me;
}
