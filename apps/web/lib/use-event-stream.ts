"use client";

/**
 * SSE client hook (FRONTEND_PLAN.md §8). Subscribes to the BFF stream proxy at
 * `/api/stream?channels=...`, which relays Redis pub/sub events from the Web
 * API. `EventSource` gives auto-reconnect for free; we additionally surface the
 * connection state so the UI can fall back to polling.
 */
import { useEffect, useRef, useState } from "react";
import { RealtimeEventSchema, type RealtimeEvent } from "@droptracker/api-types";

type ConnectionState = "connecting" | "open" | "closed";

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
    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => setState("open");
    source.onerror = () => setState("connecting"); // EventSource auto-reconnects
    source.onmessage = (msg) => {
      try {
        const parsed = RealtimeEventSchema.safeParse(JSON.parse(msg.data));
        if (parsed.success) handlerRef.current(parsed.data);
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => {
      source.close();
      setState("closed");
    };
  }, [channelKey]);

  return { state };
}
