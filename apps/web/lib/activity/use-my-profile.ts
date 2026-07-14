"use client";

/**
 * Shared "me in DropTracker" aggregate for the activity. There is no per-user
 * aggregate endpoint, so this assembles client-side: /me (bearer) gives linked
 * accounts + groups, then a fan-out to the anonymous player profiles merges
 * recent drops/clogs/PBs and badge history across accounts. Extracted from the
 * Me tab so the home hub's personal hero can share one fetch shape.
 */
import { useEffect, useMemo, useState } from "react";
import type { Me, PlayerBadge, PlayerProfile, Submission } from "@droptracker/api-types";
import { gpAmount } from "@/lib/activity/money";
import { activityMe, playerProfile } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";

/** Fan-out cap — enough for multi-account users without hammering the BFF. */
const MAX_PROFILE_FETCHES = 3;

export type MyProfile = {
  me: Me | null;
  profiles: PlayerProfile[];
  /** Newest-first drops/clogs/PBs merged across linked accounts. */
  recent: Submission[];
  badges: PlayerBadge[];
  /** Sum of this month's loot across linked accounts. */
  totalLoot: number;
  bestRank: number | null;
  loading: boolean;
  failed: boolean;
};

export function useMyProfile(): MyProfile {
  const { sessionToken } = useActivityAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meData = await activityMe(sessionToken);
        if (cancelled) return;
        setMe(meData);
        const targets = meData.players.slice(0, MAX_PROFILE_FETCHES);
        const results = await Promise.allSettled(targets.map((p) => playerProfile(p.id)));
        if (cancelled) return;
        setProfiles(results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const recent = useMemo<Submission[]>(
    () =>
      profiles
        .flatMap((p) =>
          p.recent_submissions.map((s) => ({ ...s, player_name: s.player_name ?? p.name })),
        )
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 12),
    [profiles],
  );
  const badges = useMemo(() => profiles.flatMap((p) => p.badges ?? []), [profiles]);
  const totalLoot = useMemo(
    () => (me?.players ?? []).reduce((sum, p) => sum + gpAmount(p.total_loot), 0),
    [me],
  );
  const bestRank = useMemo(() => {
    const ranks = (me?.players ?? [])
      .map((p) => p.global_rank)
      .filter((r): r is number => r != null);
    return ranks.length ? Math.min(...ranks) : null;
  }, [me]);

  return { me, profiles, recent, badges, totalLoot, bestRank, loading, failed };
}
