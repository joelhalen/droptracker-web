"use client";

/**
 * Which SSE proxy `useEventStream` should talk to, for everything under a
 * subtree.
 *
 * This is a context rather than a prop because most SSE subscribers are SHARED
 * components — the board view, bingo board, loot-sweep matrix, task progress —
 * that the site and the Discord Activity both mount. Threading an endpoint
 * prop through every one of them would work exactly until someone adds the
 * next realtime component and forgets, which is how the Activity ended up
 * streaming anonymously in the first place. With a provider at the Activity
 * root, subscribing correctly is the default and there is nothing to remember.
 *
 * The site renders no provider and keeps the plain cookie-authenticated
 * `/api/stream`.
 */
import { createContext, useContext, useMemo } from "react";
import type { StreamEndpoint } from "@/lib/use-event-stream";

const StreamEndpointContext = createContext<StreamEndpoint | null>(null);

export function StreamEndpointProvider({
  path,
  token,
  children,
}: {
  path: string;
  token: string | null;
  children: React.ReactNode;
}) {
  // Memoised on the primitives: a fresh object each render would re-key every
  // stream on the page and reconnect them all.
  const value = useMemo<StreamEndpoint>(() => ({ path, token }), [path, token]);
  return <StreamEndpointContext.Provider value={value}>{children}</StreamEndpointContext.Provider>;
}

/** The ambient endpoint, or null on the site (meaning: use the default). */
export function useStreamEndpoint(): StreamEndpoint | null {
  return useContext(StreamEndpointContext);
}
