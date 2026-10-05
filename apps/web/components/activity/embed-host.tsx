"use client";

/**
 * The Activity's embed host: how shared site components behave in here.
 * Entity links become view pushes, external links go through the SDK, and
 * images are mapped to addresses the iframe CSP allows. Mounted once, inside
 * the nav provider (pushes need it) and around the shell.
 */
import { useMemo } from "react";
import { EmbedHostProvider, type EmbedHost } from "@/lib/embed-host";
import { useActivityNav } from "@/lib/activity/nav";
import { openExternal } from "@/lib/activity/discord-sdk";
import { externalUrl } from "@/lib/activity/external-url";
import { activityImgUrl } from "@/lib/activity/img-proxy";

export function ActivityEmbedHost({ children }: { children: React.ReactNode }) {
  const { push } = useActivityNav();
  const value = useMemo<EmbedHost>(
    () => ({
      openEntity: (t) => {
        switch (t.kind) {
          case "player":
            return push({ name: "player", id: t.id });
          case "group":
            return push({ name: "group", id: t.id });
          case "npc":
            return push({ name: "npc", id: t.id, label: t.name ?? undefined });
          case "item":
            return push({ name: "item", id: t.id, label: t.name ?? undefined });
        }
      },
      openExternal: (url) => {
        const href = externalUrl(url);
        if (href) void openExternal(href);
      },
      img: activityImgUrl,
    }),
    [push],
  );
  return <EmbedHostProvider value={value}>{children}</EmbedHostProvider>;
}
