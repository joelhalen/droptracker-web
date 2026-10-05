"use client";

/**
 * NPC and item pages for the Activity. Both mount the site's own page bodies
 * (`NpcProfile`, `ItemProfile`); the Activity's embed host turns their links
 * into view pushes, so a site change to either page lands here too.
 */
import { useEffect, useState } from "react";
import type { ItemDetail } from "@droptracker/api-types";
import { ItemProfile } from "@/components/item-profile";
import { NpcProfile } from "@/components/npc-profile";
import { itemPage, npcPage, type NpcPage } from "@/lib/activity/api";
import { SITE_ORIGIN } from "@/lib/activity/external-url";
import { useActivityNav } from "@/lib/activity/nav";
import { BackBar, ErrorNote, ExternalButton, LoadingBlock } from "@/components/activity/bits";

/** Fetch-on-id with the not-found / failed split every detail view shows. */
function useDetail<T>(id: number, load: (id: number) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(null);
    load(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);
  return { data, failed };
}

export function NpcView({ id, label }: { id: number; label?: string }) {
  const nav = useActivityNav();
  const { data, failed } = useDetail<NpcPage>(id, npcPage);
  const title = data?.npc.name ?? label ?? "Boss";
  return (
    <div>
      <BackBar title={title} onBack={nav.pop} />
      {failed ? (
        <ErrorNote>
          {failed === "missing" ? "We don't track this NPC." : "Couldn't load this NPC."}
        </ErrorNote>
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          <NpcProfile npc={data.npc} dropTable={data.drop_table} pbBoard={data.pb_board} />
          <ExternalButton href={`${SITE_ORIGIN}/npcs/${id}`}>Open on droptracker.io</ExternalButton>
        </>
      )}
    </div>
  );
}

export function ItemView({ id, label }: { id: number; label?: string }) {
  const nav = useActivityNav();
  const { data, failed } = useDetail<ItemDetail>(id, itemPage);
  const title = data?.name ?? label ?? "Item";
  return (
    <div>
      <BackBar title={title} onBack={nav.pop} />
      {failed ? (
        <ErrorNote>
          {failed === "missing" ? "We don't track this item." : "Couldn't load this item."}
        </ErrorNote>
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          <ItemProfile item={data} />
          <ExternalButton href={`${SITE_ORIGIN}/items/${id}`}>Open on droptracker.io</ExternalButton>
        </>
      )}
    </div>
  );
}
