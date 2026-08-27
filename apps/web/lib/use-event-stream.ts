"use client";

/**
 * SSE client hook (FRONTEND_PLAN.md §8). Subscribes to the BFF stream proxy at
 * `/api/stream?channels=...`, which relays Redis pub/sub events from the Web
 * API.
 *
 * Connections are SHARED per channel set (audit P0-12): browsers do NOT dedupe
 * `EventSource` by URL, and an event page mounts several subscribing
 * components (task board + bingo board + board view), which used to open 2–4
 * BFF streams per viewer — each one a Quart worker slot and its own Redis
 * subscriber, multiplying exactly on the popular events. A module-level
 * refcounted registry keeps ONE EventSource per channel key and multicasts
 * frames to every registered handler; the last unmount closes it.
 *
 * `EventSource` auto-reconnects for transient network errors, but gives up
 * permanently when the response is a hard HTTP error (e.g. 401/502 →
 * `readyState === CLOSED`). We detect that and reconnect manually with capped
 * exponential backoff, and surface the connection state so the UI can show a
 * live/connecting indicator and fall back to polling if desired.
 *
 * Which proxy to talk to comes from `StreamEndpointProvider` (lib/stream-
 * endpoint.tsx), or the `endpoint` argument for a one-off. The site needs
 * neither — it defaults to the cookie-authenticated `/api/stream`. The Discord
 * Activity MUST have the provider: the iframe holds no cookies, so without it
 * every session-gated scope is refused upstream, and refusal is INVISIBLE —
 * the Web API answers 200 and silently substitutes `global` rather than
 * erroring (`_authorize_channels`, web_api/routes/realtime.py). The connection
 * then looks perfectly healthy while delivering none of the requested frames,
 * which also defeats any "poll unless the stream is open" fallback.
 */
import { useEffect, useRef, useState } from "react";
import { useStreamEndpoint } from "@/lib/stream-endpoint";
import { DEFAULT_STREAM_PATH, streamKey, streamUrl } from "@/lib/stream-key";
import { RealtimeEventSchema, type RealtimeEvent } from "@droptracker/api-types";

type ConnectionState = "connecting" | "open" | "closed";

const MAX_BACKOFF_MS = 30_000;

type FrameHandler = (event: RealtimeEvent) => void;
type StateListener = (state: ConnectionState) => void;

interface SharedStream {
  url: string;
  source: EventSource | null;
  handlers: Set<FrameHandler>;
  stateListeners: Set<StateListener>;
  state: ConnectionState;
  attempt: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

/** Where a subscriber's frames come from, when it isn't the site default. */
export type StreamEndpoint = {
  /** BFF proxy path. The Discord Activity needs `/api/activity/stream`. */
  path?: string;
  /**
   * Session JWT for the cookie-less Activity. `EventSource` cannot set an
   * Authorization header, so the activity proxy takes it as a query param and
   * re-presents it upstream as the session cookie. Null/undefined connects
   * anonymously, which is correct for public scopes.
   */
  token?: string | null;
};

const streams = new Map<string, SharedStream>();

function setStreamState(stream: SharedStream, state: ConnectionState) {
  stream.state = state;
  stream.stateListeners.forEach((listen) => listen(state));
}

function connectStream(stream: SharedStream) {
  stream.source = new EventSource(stream.url, { withCredentials: true });

  stream.source.onopen = () => {
    stream.attempt = 0;
    setStreamState(stream, "open");
  };

  stream.source.onmessage = (msg) => {
    try {
      const parsed = RealtimeEventSchema.safeParse(JSON.parse(msg.data));
      if (parsed.success) {
        stream.handlers.forEach((handle) => handle(parsed.data));
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  stream.source.onerror = () => {
    // A hard error closes the source permanently; reconnect ourselves with
    // backoff. Transient errors keep it in CONNECTING and self-heal.
    if (stream.source && stream.source.readyState === EventSource.CLOSED) {
      stream.source.close();
      setStreamState(stream, "connecting");
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** stream.attempt);
      stream.attempt += 1;
      stream.reconnectTimer = setTimeout(() => connectStream(stream), delay);
    } else {
      setStreamState(stream, "connecting");
    }
  };
}

function acquireStream(key: string, url: string): SharedStream {
  let stream = streams.get(key);
  if (!stream) {
    stream = {
      url,
      source: null,
      handlers: new Set(),
      stateListeners: new Set(),
      state: "connecting",
      attempt: 0,
    };
    streams.set(key, stream);
    connectStream(stream);
  }
  return stream;
}

function releaseStream(key: string, handler: FrameHandler, stateListener: StateListener) {
  const stream = streams.get(key);
  if (!stream) return;
  stream.handlers.delete(handler);
  stream.stateListeners.delete(stateListener);
  if (stream.handlers.size === 0) {
    if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
    stream.source?.close();
    streams.delete(key);
  }
}

export function useEventStream(
  channels: string[],
  onEvent: (event: RealtimeEvent) => void,
  endpoint?: StreamEndpoint,
): { state: ConnectionState } {
  const [state, setState] = useState<ConnectionState>("connecting");
  // Keep the latest callback without re-subscribing on every render.
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  // An explicit argument wins; otherwise take the ambient endpoint, which is
  // how shared components get the Activity's authenticated proxy without
  // knowing they're inside the iframe.
  const ambient = useStreamEndpoint();
  const resolved = endpoint ?? ambient;

  const channelKey = channels.join(",");
  const path = resolved?.path ?? DEFAULT_STREAM_PATH;
  // Normalised to a string so the effect's dep list stays primitive, and so a
  // token arriving later re-keys the stream and reconnects it authenticated.
  const token = resolved?.token ?? "";

  useEffect(() => {
    if (!channelKey) return;

    const handler: FrameHandler = (event) => handlerRef.current(event);
    const stateListener: StateListener = (s) => setState(s);

    const key = streamKey(channelKey, path, token);
    const stream = acquireStream(key, streamUrl(channelKey, path, token));
    stream.handlers.add(handler);
    stream.stateListeners.add(stateListener);
    // Reflect the shared connection's current state immediately (it may
    // already be open from another subscriber on the page).
    setState(stream.state);

    return () => {
      releaseStream(key, handler, stateListener);
      setState("closed");
    };
  }, [channelKey, path, token]);

  return { state };
}
