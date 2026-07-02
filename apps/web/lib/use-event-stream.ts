"use client";

/**
 * SSE client hook (FRONTEND_PLAN.md §8). Subscribes to the BFF stream proxy at
 * `/api/stream?channels=...`, which relays Redis pub/sub events from the Web
 * API.
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

    const url = `/api/stream?channels=${encodeURIComponent(channelKey)}`;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setState((s) => (s === "open" ? s : "connecting"));
      source = new EventSource(url, { withCredentials: true });

      source.onopen = () => {
        attempt = 0;
        setState("open");
      };

      source.onmessage = (msg) => {
        try {
          const parsed = RealtimeEventSchema.safeParse(JSON.parse(msg.data));
          if (parsed.success) handlerRef.current(parsed.data);
        } catch {
          /* ignore malformed frames */
        }
      };

      source.onerror = () => {
        // A hard error closes the source permanently; reconnect ourselves with
        // backoff. Transient errors keep it in CONNECTING and self-heal.
        if (source && source.readyState === EventSource.CLOSED) {
          source.close();
          setState("connecting");
          const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
          attempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        } else {
          setState("connecting");
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      setState("closed");
    };
  }, [channelKey]);

  return { state };
}
