"use client";

/**
 * What a SHARED component should do when it is mounted somewhere other than
 * the site: today, the Discord Activity.
 *
 * Inside the Activity's iframe three site habits break: `<Link>` navigation
 * leaves the single-page app (there are no routes), `target="_blank"` and
 * `window.open` are inert, and absolute image URLs are blocked by the CSP.
 * Shared components used to take per-component props for each of these
 * (`onOpenPlayer`, `openLink`, `imgBase`), threaded by hand, and every new
 * component that forgot one became a silent dead end in the Activity.
 *
 * Like `StreamEndpointProvider`, this is a context so the right behaviour is
 * the default: the Activity mounts one provider at its root and anything below
 * it, however deep, asks `useEmbedHost()`. The site renders no provider, gets
 * `null`, and keeps its links.
 *
 * Existing explicit props still win where a component has them; this is the
 * fallback they did not have.
 */
import { createContext, useContext } from "react";

/** An entity a shared component can send the viewer to. */
export type EntityTarget =
  | { kind: "player"; id: number; name?: string | null }
  | { kind: "group"; id: number; name?: string | null }
  | { kind: "npc"; id: number; name?: string | null }
  | { kind: "item"; id: number; name?: string | null };

export type EmbedHost = {
  /** Show an entity in place of following a site link. */
  openEntity: (target: EntityTarget) => void;
  /** Open an absolute URL outside the embedding app. */
  openExternal: (url: string) => void;
  /** The address an `<img>` should load `url` from. */
  img: (url: string | null | undefined) => string | null | undefined;
};

const EmbedHostContext = createContext<EmbedHost | null>(null);

export function EmbedHostProvider({
  value,
  children,
}: {
  /** Must be referentially stable (memoise it), or every consumer re-renders. */
  value: EmbedHost;
  children: React.ReactNode;
}) {
  return <EmbedHostContext.Provider value={value}>{children}</EmbedHostContext.Provider>;
}

/** The embedding host, or null on the site. */
export function useEmbedHost(): EmbedHost | null {
  return useContext(EmbedHostContext);
}

/** `img()` through the host when there is one, unchanged on the site. */
export function useImgUrl(): (url: string | null | undefined) => string | undefined {
  const host = useEmbedHost();
  return (url) => (host ? host.img(url) : url) ?? undefined;
}
