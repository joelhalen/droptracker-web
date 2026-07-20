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
 */
import { useEffect, useRef, useState } from "react";
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

function acquireStream(channelKey: string): SharedStream {
  let stream = streams.get(channelKey);
  if (!stream) {
    stream = {
      url: `/api/stream?channels=${encodeURIComponent(channelKey)}`,
      source: null,
      handlers: new Set(),
      stateListeners: new Set(),
      state: "connecting",
      attempt: 0,
    };
    streams.set(channelKey, stream);
    connectStream(stream);
  }
  return stream;
}

function releaseStream(
  channelKey: string,
  handler: FrameHandler,
  stateListener: StateListener,
) {
  const stream = streams.get(channelKey);
  if (!stream) return;
  stream.handlers.delete(handler);
  stream.stateListeners.delete(stateListener);
  if (stream.handlers.size === 0) {
    if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
    stream.source?.close();
    streams.delete(channelKey);
  }
}

export function useEventStream(
  channels: string[],
  onEvent: (event: RealtimeEvent) => void,
): { state: ConnectionState } {
  const [state, setState] = useState<ConnectionState>("connecting");
  // Keep the latest callback without re-subscribing on every render.
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const channelKey = channels.join(",");

  useEffect(() => {
    if (!channelKey) return;

    const handler: FrameHandler = (event) => handlerRef.current(event);
    const stateListener: StateListener = (s) => setState(s);

    const stream = acquireStream(channelKey);
    stream.handlers.add(handler);
    stream.stateListeners.add(stateListener);
    // Reflect the shared connection's current state immediately (it may
    // already be open from another subscriber on the page).
    setState(stream.state);

    return () => {
      releaseStream(channelKey, handler, stateListener);
      setState("closed");
    };
  }, [channelKey]);

  return { state };
}
