"use client";

/**
 * Notification list editors (group settings): the blacklist and its inverse.
 *
 * One generic card serves both, because the two features are the same control
 * pointed in opposite directions. **Blacklist**: items, NPCs and places whose
 * submissions must never be announced. **Always announce**: items and NPCs
 * whose drops are announced even below the group's minimum notification value
 * — built for the "notable" zero-value kits and pieces the plugin
 * force-screenshots, which would otherwise never clear the value threshold.
 *
 * The wording throughout is deliberate: neither list touches the data. A
 * blacklisted drop is still **recorded, scored and counted**; an
 * always-announced one gains only its Discord post. Every clan that asked for
 * these wanted control of the feed, not of the totals, and a control that
 * looked like it changed scores would not get used.
 *
 * The item and NPC pickers search the same `/events/meta/*` catalogs the event
 * task builder uses, so they only offer names actually seen in the drop
 * history. The place picker (blacklist only) filters a fixed list of named map
 * areas instead. A hand-typed name is still allowed everywhere (Enter adds the
 * query as-is); the backend refuses names it could never match and its message
 * is shown verbatim.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import type {
  BlacklistEntryType,
  EventMetaEntry,
  NotificationBlacklist,
  NotificationBlacklistEntry,
} from "@droptracker/api-types";
import {
  addAlwaysListEntry,
  addBlacklistEntry,
  removeAlwaysListEntry,
  removeBlacklistEntry,
  searchBlacklistCandidates,
} from "@/app/(site)/(admin)/groups/[id]/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, Button, Card, EmptyState, Input } from "@/components/ui";

const IMG_BASE = "https://www.droptracker.io/img";

type KindSpec = {
  key: BlacklistEntryType;
  label: string;
  placeholder: string;
  hint: string;
  emptySubject: string;
  emptyAction: string;
};

/** Everything that differs between the two cards. */
type ListCopy = {
  title: string;
  blurb: React.ReactNode;
  kinds: KindSpec[];
  /** Badge on a search result that is already on the list. */
  alreadyBadge: string;
  /** aria-label prefix for an entry's remove button. */
  removeLabel: (name: string) => string;
  fullMessage: (limit: number) => string;
  emptyHint: (action: string) => string;
  add: (
    groupId: number,
    kind: BlacklistEntryType,
    name: string,
    gameId: number | null,
  ) => Promise<NotificationBlacklist>;
  remove: (groupId: number, entryId: number) => Promise<NotificationBlacklist>;
};

function EntityIcon({ kind, id }: { kind: BlacklistEntryType; id: number | null }) {
  // Places have no artwork, and a region id is not an npc id — rendering one
  // through the NPC image path would request a wrong, existing sprite.
  if (id == null || kind === "region") return <span className="inline-block h-5 w-5 shrink-0" />;
  return (
    <img
      src={`${IMG_BASE}/${kind === "item" ? "itemdb" : "npcdb"}/${id}.png`}
      alt=""
      width={20}
      height={20}
      className="inline-block h-5 w-5 shrink-0 object-contain"
      draggable={false}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function NotificationListCard({
  groupId,
  initial,
  copy,
}: {
  groupId: number;
  initial: NotificationBlacklist;
  copy: ListCopy;
}) {
  const [entries, setEntries] = useState<NotificationBlacklistEntry[]>(initial.entries);
  const [kind, setKind] = useState<BlacklistEntryType>(copy.kinds[0]!.key);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Monotonic sequence: a slow search must never overwrite a newer one's rows.
  const seq = useRef(0);

  const active = copy.kinds.find((k) => k.key === kind)!;
  const shown = entries.filter((e) => e.entry_type === kind);
  const full = entries.length >= initial.limit;

  // Debounced autocomplete. Switching kind clears the rows immediately so the
  // list can never show items under the NPC tab.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const rows = await searchBlacklistCandidates(groupId, kind, q);
        if (seq.current === mine) setResults(rows);
      } catch {
        // A failed lookup leaves the box usable: Enter still adds the typed name.
        if (seq.current === mine) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [groupId, kind, query]);

  const alreadyListed = (name: string) =>
    shown.some((e) => e.name.toLowerCase() === name.toLowerCase());

  const onAdd = (name: string, gameId: number | null) => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await copy.add(groupId, kind, trimmed, gameId);
        setEntries(next.entries);
        setQuery("");
        setResults([]);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add that entry. Please try again."));
      }
    });
  };

  const onRemove = (entryId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        setEntries((await copy.remove(groupId, entryId)).entries);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove that entry. Please try again."));
      }
    });
  };

  return (
    <Card padding="p-6" className="mb-6">
      <h2 className="text-osrs-gold mb-1 text-lg font-semibold">{copy.title}</h2>
      <p className="text-osrs-parchment-dark/60 mb-4 text-xs">{copy.blurb}</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {copy.kinds.map((k) => (
          <Button
            key={k.key}
            variant={k.key === kind ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setKind(k.key);
              setQuery("");
              setResults([]);
              setError(null);
            }}
          >
            {k.label}
            <Badge variant={k.key === kind ? "bronze" : "neutral"} size="sm">
              {entries.filter((e) => e.entry_type === k.key).length}
            </Badge>
          </Button>
        ))}
      </div>

      <p className="text-osrs-parchment-dark/50 mb-2 text-xs">{active.hint}</p>

      <div className="relative">
        <Input
          type="search"
          value={query}
          placeholder={active.placeholder}
          disabled={full}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter takes the top result when there is one, otherwise the raw
            // query — so a name the catalog has not seen yet is still addable.
            const top = results[0];
            if (top) onAdd(top.name, top.id);
            else onAdd(query, null);
          }}
        />
        {results.length > 0 && (
          <ul className="border-osrs-bronze/40 bg-osrs-brown-dark absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border shadow-lg">
            {results.map((row) => {
              const listed = alreadyListed(row.name);
              return (
                <li key={`${row.id}-${row.name}`}>
                  <button
                    type="button"
                    disabled={listed || pending}
                    onClick={() => onAdd(row.name, row.id)}
                    className="hover:bg-osrs-bronze/20 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm disabled:opacity-50"
                  >
                    <EntityIcon kind={kind} id={row.id} />
                    <span className="truncate">{row.name}</span>
                    {listed && (
                      <Badge variant="neutral" size="sm">
                        {copy.alreadyBadge}
                      </Badge>
                    )}
                    {row.tracked === false && !listed && (
                      <Badge variant="ember" size="sm">
                        never seen in a drop
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {full && <p className="text-osrs-ember mt-2 text-xs">{copy.fullMessage(initial.limit)}</p>}

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4">
        {shown.length === 0 ? (
          <EmptyState
            title={`No ${active.emptySubject}`}
            hint={copy.emptyHint(active.emptyAction)}
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {shown.map((entry) => (
              <li
                key={entry.id}
                className="border-osrs-bronze/40 bg-osrs-stone/10 flex items-center gap-2 rounded border px-2 py-1 text-sm"
              >
                <EntityIcon kind={entry.entry_type} id={entry.game_id} />
                <span className="truncate">{entry.name}</span>
                {entry.entry_type === "region" && entry.resolved_name && (
                  <span className="text-osrs-parchment-dark/50 truncate text-xs">
                    {entry.resolved_name}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={copy.removeLabel(entry.name)}
                  disabled={pending}
                  onClick={() => onRemove(entry.id)}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-red cursor-pointer px-1 leading-none disabled:opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

const BLACKLIST_COPY: ListCopy = {
  title: "Notification blacklist",
  blurb: (
    <>
      Items, NPCs and places your Discord channels never hear about. Blacklisted
      submissions are still <strong>recorded, scored and counted</strong> — on your
      lootboard, leaderboards, points and events. Only the Discord message is withheld.
    </>
  ),
  kinds: [
    {
      key: "item",
      label: "Items",
      placeholder: "Search items — Bones, Coins, Ranarr seed…",
      hint: "Nothing is posted about this item, whatever drops it.",
      emptySubject: "items blacklisted",
      emptyAction: "mute an item",
    },
    {
      key: "npc",
      label: "NPCs & bosses",
      placeholder: "Search NPCs — Barrows, Zulrah, Chambers of Xeric…",
      hint: "Nothing from this source is posted, whichever item drops.",
      emptySubject: "NPCs blacklisted",
      emptyAction: "mute everything from a boss or NPC",
    },
    {
      key: "region",
      label: "Places",
      placeholder: "Search places — Castle Wars, Wilderness, Prifddinas… or a region id",
      hint:
        "Nothing that happens here is posted — deaths, for now. Picking an area covers " +
        "every map region it spans; type a bare region id to mute just that one.",
      emptySubject: "places blacklisted",
      emptyAction: "mute everything that happens somewhere",
    },
  ],
  alreadyBadge: "already muted",
  removeLabel: (name) => `Stop blacklisting ${name}`,
  fullMessage: (limit) =>
    `This group has reached the ${limit}-entry limit. Remove one to add another — ` +
    "or raise the minimum notification value instead.",
  emptyHint: (action) => `Search above to ${action} in your Discord notifications.`,
  add: addBlacklistEntry,
  remove: removeBlacklistEntry,
};

const ALWAYS_COPY: ListCopy = {
  title: "Always announce",
  blurb: (
    <>
      Items and NPCs your Discord channels <strong>always</strong> hear about: a drop of
      a listed item — or from a listed NPC — is announced even below your minimum
      notification value. Made for notable valueless drops like ornament kits and dyes,
      which the plugin already screenshots but the value threshold would silence. Your
      other rules still apply: a screenshot requirement still holds back imageless
      drops, and the blacklist wins if a name is somehow on both lists.
    </>
  ),
  kinds: [
    {
      key: "item",
      label: "Items",
      placeholder: "Search items — Twisted ancestral colour kit, Dragon defender…",
      hint: "Every drop of this item is announced, whatever it's worth and whatever drops it.",
      emptySubject: "items always announced",
      emptyAction: "always announce an item",
    },
    {
      key: "npc",
      label: "NPCs & bosses",
      placeholder: "Search NPCs — Zulrah, Chambers of Xeric…",
      hint: "Every drop from this source is announced, whatever it's worth — including the junk. Most groups want specific items instead.",
      emptySubject: "NPCs always announced",
      emptyAction: "always announce everything from a boss or NPC",
    },
  ],
  alreadyBadge: "already listed",
  removeLabel: (name) => `Stop always announcing ${name}`,
  fullMessage: (limit) =>
    `This group has reached the ${limit}-entry limit. Remove one to add another — ` +
    "or lower the minimum notification value instead.",
  emptyHint: (action) =>
    `Search above to ${action} in your Discord notifications, even below your minimum value.`,
  // This card's kinds array offers no "region" tab, so kind can only be
  // item/npc here — narrowed explicitly to satisfy the stricter action type.
  add: (groupId, kind, name, gameId) =>
    addAlwaysListEntry(groupId, kind === "npc" ? "npc" : "item", name, gameId),
  remove: removeAlwaysListEntry,
};

export function NotificationBlacklistCard(props: {
  groupId: number;
  initial: NotificationBlacklist;
}) {
  return <NotificationListCard {...props} copy={BLACKLIST_COPY} />;
}

export function NotificationAlwaysListCard(props: {
  groupId: number;
  initial: NotificationBlacklist;
}) {
  return <NotificationListCard {...props} copy={ALWAYS_COPY} />;
}
