"use client";

/**
 * Staff → user DM opener (web102a phase 3). Debounced user search (the
 * `player-add-input.tsx` pattern), pick a hit, write the opening message, and
 * `startStaffChat` returns the target's single staff_dm thread — new or
 * reopened — which the widget then opens in place. The backend DMs the user on
 * Discord with a link back to /messages/{threadId}.
 *
 * Existing staff conversations are listed below the search so staff can jump
 * back into one instead of re-opening it.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import type { ChatThread, StaffUserHit } from "@droptracker/api-types";
import { CHAT_BODY_MAX_CHARS } from "@droptracker/api-types";
import { loadStaffChats, searchStaffUsers, startStaffChat } from "@/app/(site)/support-actions";
import { Alert, Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

const SEARCH_DEBOUNCE_MS = 300;

function hitLabel(hit: StaffUserHit): string {
  return hit.display_name ?? `Discord ${hit.discord_id}`;
}

/** The person a staff_dm thread is about — its one `user` participant. */
function threadUserLabel(thread: ChatThread): string {
  const user = thread.participants.find((p) => p.party_type === "user");
  return user?.name ?? thread.title ?? `Thread #${thread.id}`;
}

export function StaffNewChat() {
  const { push } = useChatWidget();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffUserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [target, setTarget] = useState<StaffUserHit | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const seq = useRef(0);

  const [chats, setChats] = useState<ChatThread[] | null>(null);
  const [chatsError, setChatsError] = useState<string | null>(null);

  // Debounced live search; a sequence guard drops stale responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await searchStaffUsers(q);
        if (seq.current === mine) {
          setResults(rows);
          setSearched(true);
        }
      } catch (err) {
        if (seq.current === mine) {
          setResults([]);
          setError(getErrorMessage(err, "Search failed. Please try again."));
        }
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Existing staff conversations, once.
  useEffect(() => {
    let active = true;
    loadStaffChats()
      .then((page) => active && setChats(page.items))
      .catch((err) => {
        if (active) setChatsError(getErrorMessage(err, "Couldn't load existing chats."));
      });
    return () => {
      active = false;
    };
  }, []);

  const overLimit = body.length > CHAT_BODY_MAX_CHARS;

  const send = () => {
    const trimmed = body.trim();
    if (!target || !trimmed || overLimit || sending) return;
    setError(null);
    startSending(async () => {
      try {
        const thread = await startStaffChat({ user_id: target.user_id, body: trimmed });
        setBody("");
        push({ kind: "chat", threadId: thread.id });
      } catch (err) {
        setError(
          getErrorMessage(err, "Couldn't start that conversation. Please try again."),
        );
      }
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <label className="text-osrs-parchment-dark/70 mb-1 text-xs" htmlFor="staff-user-search">
        Who do you want to message?
      </label>
      <input
        id="staff-user-search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setTarget(null);
        }}
        placeholder="Search by display name or Discord id…"
        autoComplete="off"
        className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 mb-2 w-full rounded border px-3 py-2 text-sm outline-none"
      />

      {error && (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      )}

      {!target && (
        <div className="mb-3">
          {searching ? (
            <p className="text-osrs-parchment-dark/50 text-xs">Searching…</p>
          ) : results.length > 0 ? (
            <ul className="border-osrs-bronze/25 divide-osrs-bronze/15 divide-y rounded border">
              {results.map((hit) => (
                <li key={hit.user_id}>
                  <button
                    type="button"
                    onClick={() => setTarget(hit)}
                    className="hover:bg-osrs-bronze/10 flex w-full items-baseline gap-2 px-3 py-2 text-left"
                  >
                    <span className="text-osrs-parchment min-w-0 truncate text-sm">
                      {hitLabel(hit)}
                    </span>
                    <span className="text-osrs-parchment-dark/50 ml-auto shrink-0 text-[11px]">
                      {hit.discord_id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <p className="text-osrs-parchment-dark/50 text-xs">
              Nobody matches — try their exact display name or Discord id.
            </p>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">
              At least two characters to search.
            </p>
          )}
        </div>
      )}

      {target && (
        <div className="mb-3 space-y-2">
          <p className="text-osrs-parchment-dark/70 text-xs">
            Opening message to <span className="text-osrs-parchment">{hitLabel(target)}</span> —
            they&apos;ll get a Discord DM with a link back here.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Write the opening message…"
            disabled={sending}
            aria-label="Opening message"
            className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 w-full resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          {overLimit && (
            <p className="text-osrs-red text-xs">
              {body.length} / {CHAT_BODY_MAX_CHARS} characters — too long to send.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setTarget(null)} disabled={sending}>
              Back to search
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={send}
              disabled={sending || overLimit || !body.trim()}
            >
              {sending ? "Starting…" : "Start conversation"}
            </Button>
          </div>
        </div>
      )}

      <div className="border-osrs-bronze/25 mt-auto border-t pt-2">
        <p className="text-osrs-parchment-dark/50 mb-1 text-xs">Existing conversations</p>
        {chatsError ? (
          <p className="text-osrs-parchment-dark/50 text-xs">{chatsError}</p>
        ) : chats == null ? (
          <p className="text-osrs-parchment-dark/50 text-xs">Loading…</p>
        ) : chats.length === 0 ? (
          <p className="text-osrs-parchment-dark/50 text-xs">No staff conversations yet.</p>
        ) : (
          <ul className="divide-osrs-bronze/15 divide-y">
            {chats.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => push({ kind: "chat", threadId: thread.id })}
                  className="hover:bg-osrs-bronze/10 flex w-full items-center gap-2 px-1 py-1.5 text-left"
                >
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate text-sm">
                    {threadUserLabel(thread)}
                  </span>
                  {thread.last_message_at != null && (
                    <span className="text-osrs-parchment-dark/50 shrink-0 text-[11px]">
                      {formatRelativeTime(thread.last_message_at)}
                    </span>
                  )}
                  {thread.unread > 0 && (
                    <span className="bg-osrs-gold text-osrs-brown-dark shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                      {thread.unread > 9 ? "9+" : thread.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
