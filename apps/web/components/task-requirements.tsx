"use client";

/**
 * "What counts for this task" — the qualifying items/pets/NPCs, named.
 *
 * The gap this fills: a task like "obtain any 3 pets" over a 39-name allow
 * list rendered as one line of prose. The list existed only in the raw config
 * JSON, so a participant could not tell a qualifying pet from one that would
 * silently not credit, and an organiser could not proof-read what they built.
 *
 * Deliberately team-independent (GET …/tasks/{id}/requirements): it renders
 * before teams exist, on a draft event, and inside the admin task list — none
 * of which have a progress breakdown to hang off. Where a live per-team
 * breakdown IS available, `task-detail.tsx` shows this first (what counts) and
 * the checklist second (how far we've got).
 *
 * Long lists (39 pets, a 60-item point pool) render as a wrapped icon grid
 * with the name on hover and an expandable full name list, rather than 39
 * stacked rows nobody scrolls through.
 */

import { useEffect, useState } from "react";
import {
  TaskRequirementsSchema,
  type TaskRequirementGroup,
  type TaskRequirementItem,
  type TaskRequirements,
} from "@droptracker/api-types";
import { tileIconUrl } from "@/components/bingo-tile";

/** Loads a task's requirement list. Injected by the Activity (bearer token);
 * the website defaults to the same-origin cookie BFF. */
export type RequirementsFetcher = (taskId: number) => Promise<TaskRequirements>;

function siteFetcher(eventId: number): RequirementsFetcher {
  return async (taskId) => {
    const res = await fetch(`/api/events/${eventId}/tasks/${taskId}/requirements`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`requirements ${res.status}`);
    return TaskRequirementsSchema.parse(await res.json());
  };
}

/** Module-level cache: requirements only change when the task is edited, and
 * the hover card remounts on every pass of the mouse. Keyed by (event, task);
 * no TTL — a task edit reloads the page that mounts this. */
const cache = new Map<string, TaskRequirements>();
const inflight = new Map<string, Promise<TaskRequirements>>();

const cacheKey = (eventId: number, taskId: number) => `${eventId}:${taskId}`;

export function peekTaskRequirements(
  eventId: number,
  taskId: number,
): TaskRequirements | undefined {
  return cache.get(cacheKey(eventId, taskId));
}

export function clearTaskRequirementsCache(): void {
  cache.clear();
  inflight.clear();
}

function load(
  fetcher: RequirementsFetcher,
  eventId: number,
  taskId: number,
): Promise<TaskRequirements> {
  const key = cacheKey(eventId, taskId);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = fetcher(taskId)
    .then((data) => {
      cache.set(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Above this many entries a group renders as an icon grid rather than rows —
 * 39 stacked name rows is a scroll, not a list. */
const GRID_THRESHOLD = 6;

function itemTitle(item: TaskRequirementItem): string {
  const parts = [item.name];
  if (item.required > 1) parts.push(`×${item.required.toLocaleString()}`);
  if (item.points != null) parts.push(`${item.points} pts`);
  return parts.join(" · ");
}

/** One qualifying entry as an icon with its name on hover. */
function RequirementIcon({ item }: { item: TaskRequirementItem }) {
  const url = item.icon ? tileIconUrl(item.icon) : null;
  const title = itemTitle(item);
  return (
    <span
      className="border-osrs-bronze/25 bg-osrs-brown-dark/50 relative flex size-8 items-center justify-center rounded border"
      title={title}
      aria-label={title}
    >
      {url ? (
        <img src={url} alt="" className="size-6 object-contain" loading="lazy" decoding="async" />
      ) : (
        <span className="text-osrs-parchment-dark/60 px-0.5 text-[8px] leading-none">
          {item.name.slice(0, 4)}
        </span>
      )}
      {/* One corner badge only — a weighted item that also carries a quantity
          would otherwise stack two numbers on the same pixels. Points win:
          they're what a point pool is scored on. */}
      {item.points != null ? (
        <span
          className="text-osrs-gold-bright absolute -right-0.5 -bottom-0.5 text-[9px] leading-none font-bold"
          style={{ textShadow: "1px 1px 0 #000" }}
        >
          {item.points}
        </span>
      ) : (
        item.required > 1 && (
          <span
            className="absolute -right-0.5 -bottom-0.5 text-[9px] leading-none font-bold text-[#ffff00]"
            style={{ textShadow: "1px 1px 0 #000" }}
          >
            ×{item.required > 999 ? `${Math.round(item.required / 1000)}k` : item.required}
          </span>
        )
      )}
    </span>
  );
}

/** One qualifying entry as an icon + name row (short lists). */
function RequirementRow({ item }: { item: TaskRequirementItem }) {
  const url = item.icon ? tileIconUrl(item.icon) : null;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="border-osrs-bronze/25 bg-osrs-brown-dark/50 flex size-6 shrink-0 items-center justify-center rounded border">
        {url ? (
          <img src={url} alt="" className="size-5 object-contain" loading="lazy" />
        ) : (
          <span className="text-osrs-parchment-dark/40 text-[10px]">?</span>
        )}
      </span>
      <span className="text-osrs-parchment-dark/85 min-w-0 flex-1 truncate text-xs">
        {item.name}
      </span>
      {item.required > 1 && (
        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
          ×{item.required.toLocaleString()}
        </span>
      )}
      {item.points != null && (
        <span className="text-osrs-gold/80 shrink-0 text-xs tabular-nums">{item.points} pts</span>
      )}
    </div>
  );
}

function RequirementGroupView({ group }: { group: TaskRequirementGroup }) {
  const [showNames, setShowNames] = useState(false);
  const asGrid = group.items.length > GRID_THRESHOLD;
  return (
    <div className="grid gap-1">
      {(group.label || group.items.length > 1) && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-osrs-gold-bright/70 text-[10px] font-semibold uppercase">
            {group.label ?? "Requires"}
          </span>
          <span className="text-osrs-parchment-dark/45 text-[10px]">
            {group.items.length} {group.items.length === 1 ? "option" : "options"}
            {group.unit ? ` · ${group.need.toLocaleString()} ${group.unit}` : ""}
          </span>
        </div>
      )}
      {asGrid ? (
        <>
          <div className="flex flex-wrap gap-1">
            {group.items.map((item, i) => (
              <RequirementIcon key={`${item.name}-${i}`} item={item} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowNames((v) => !v)}
            className="text-osrs-parchment-dark/55 hover:text-osrs-gold-bright self-start text-[10px] underline decoration-dotted underline-offset-2"
          >
            {showNames ? "Hide names" : "Show all names"}
          </button>
          {showNames && (
            <p className="text-osrs-parchment-dark/70 text-[11px] leading-relaxed">
              {group.items.map((i) => itemTitle(i)).join(" · ")}
            </p>
          )}
        </>
      ) : (
        <div className="grid">
          {group.items.map((item, i) => (
            <RequirementRow key={`${item.name}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NpcChips({
  npcs,
}: {
  npcs: { name: string; icon?: { type: string; id?: number | null; name: string } | null }[];
}) {
  if (!npcs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {npcs.map((n, i) => {
        const url = n.icon
          ? tileIconUrl(n.icon as Parameters<typeof tileIconUrl>[0])
          : null;
        return (
          <span
            key={`${n.name}-${i}`}
            className="border-osrs-bronze/25 bg-osrs-brown-dark/50 text-osrs-parchment-dark/80 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
          >
            {url && <img src={url} alt="" className="size-4 object-contain" loading="lazy" />}
            {n.name}
          </span>
        );
      })}
    </div>
  );
}

/** The requirement body. Pass `data` to render a payload you already have
 * (the admin preview fetches through a server action); omit it and the
 * component loads its own through `fetchRequirements` / the site BFF. */
export function TaskRequirementsContent({
  eventId,
  taskId,
  data,
  fetchRequirements,
  compact = false,
}: {
  eventId: number;
  taskId: number;
  data?: TaskRequirements | null;
  fetchRequirements?: RequirementsFetcher;
  /** Drop the summary line — the host already prints the goal. */
  compact?: boolean;
}) {
  const seed = data ?? peekTaskRequirements(eventId, taskId) ?? null;
  const [req, setReq] = useState<TaskRequirements | null>(seed);
  const [state, setState] = useState<"loading" | "ready" | "error">(seed ? "ready" : "loading");

  useEffect(() => {
    if (data) {
      setReq(data);
      setState("ready");
      return;
    }
    let cancelled = false;
    const hit = peekTaskRequirements(eventId, taskId);
    if (hit) {
      setReq(hit);
      setState("ready");
      return;
    }
    setState("loading");
    load(fetchRequirements ?? siteFetcher(eventId), eventId, taskId)
      .then((res) => {
        if (cancelled) return;
        setReq(res);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, taskId, data, fetchRequirements]);

  if (state === "loading") {
    return <p className="text-osrs-parchment-dark/45 text-xs">Loading requirements…</p>;
  }
  if (state === "error" || !req) {
    return (
      <p className="text-osrs-parchment-dark/45 text-xs">
        Couldn’t load what counts for this task.
      </p>
    );
  }

  const hasDetail =
    req.groups.length > 0 || req.paths.length > 0 || req.npcs.length > 0 || req.notes.length > 0;
  if (!hasDetail && !req.summary) return null;

  return (
    <div className="grid gap-2">
      {!compact && req.summary && (
        <p className="text-osrs-parchment/85 text-xs">{req.summary}</p>
      )}

      {req.groups.map((g, i) => (
        <RequirementGroupView key={i} group={g} />
      ))}

      {req.paths.map((p, i) => (
        <div key={i} className="grid gap-1">
          {i > 0 && (
            <span className="text-osrs-gold-bright/70 text-center text-[10px] font-bold uppercase">
              — or —
            </span>
          )}
          <div className="border-osrs-bronze/20 grid gap-1 rounded border p-2">
            <span className="text-osrs-parchment-dark/70 text-[10px] font-semibold uppercase">
              {p.label}
            </span>
            {p.metric ? (
              <NpcChips npcs={p.npcs} />
            ) : (
              p.groups.map((g, gi) => <RequirementGroupView key={gi} group={g} />)
            )}
          </div>
        </div>
      ))}

      {req.groups.length === 0 && req.paths.length === 0 && req.npcs.length > 0 && (
        <NpcChips npcs={req.npcs} />
      )}

      {req.notes.length > 0 && (
        <ul className="text-osrs-parchment-dark/55 grid gap-0.5 text-[10px] leading-snug">
          {req.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Collapsible wrapper — the form used inside the task detail card and the
 * admin task list, where the requirement list is supporting detail rather than
 * the headline. Nothing is fetched until it is opened. */
export function TaskRequirementsDisclosure({
  eventId,
  taskId,
  itemCountHint,
  fetchRequirements,
  defaultOpen = false,
}: {
  eventId: number;
  taskId: number;
  /** Shown in the summary before the payload loads ("39 pets qualify"). */
  itemCountHint?: string;
  fetchRequirements?: RequirementsFetcher;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="border-osrs-bronze/20 rounded border px-2 py-1.5"
    >
      <summary className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright cursor-pointer text-xs select-none">
        What counts{itemCountHint ? ` · ${itemCountHint}` : ""}
      </summary>
      <div className="mt-2">
        {open && (
          <TaskRequirementsContent
            eventId={eventId}
            taskId={taskId}
            fetchRequirements={fetchRequirements}
          />
        )}
      </div>
    </details>
  );
}
