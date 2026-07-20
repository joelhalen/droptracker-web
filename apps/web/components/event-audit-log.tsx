"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { AuditEntry, EventAudit } from "@/lib/api";
import { eventAuditLog } from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

/** Filter buckets, in display order. Keys match the backend's `category`. */
const CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ["auto_credit", "Auto credits"],
  ["pending_submission", "Pending"],
  ["approval", "Approvals"],
  ["manual_award", "Manual awards"],
  ["revoke", "Revokes"],
  ["task", "Task edits"],
  ["settings", "Settings"],
  ["team", "Teams"],
  ["participant", "Participants"],
  ["signup", "Signups"],
  ["board", "Board"],
  ["prize", "Prize pot"],
  ["discord", "Discord"],
];

const CATEGORY_TINT: Record<string, string> = {
  auto_credit: "text-osrs-green",
  pending_submission: "text-osrs-gold",
  approval: "text-osrs-green",
  manual_award: "text-osrs-gold",
  revoke: "text-osrs-red",
};

function prettyValue(raw: string | null): string {
  if (raw == null) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const PAGE_SIZE = 50;

export function EventAuditLog({ groupId, eventId }: { groupId: number | null; eventId: number }) {
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [player, setPlayer] = useState("");
  const [team, setTeam] = useState("");
  const [task, setTask] = useState("");
  const [hasProof, setHasProof] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<EventAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const num = (s: string) => {
    const n = Number(s);
    return s.trim() !== "" && Number.isInteger(n) && n > 0 ? n : undefined;
  };

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await eventAuditLog(groupId, eventId, {
          page: nextPage,
          limit: PAGE_SIZE,
          category: cats.size ? [...cats] : undefined,
          actorUserId: num(actor),
          playerId: num(player),
          teamId: num(team),
          taskId: num(task),
          hasProof: hasProof || undefined,
          q: q.trim() || undefined,
        });
        setData(res);
        setPage(nextPage);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [groupId, eventId, cats, actor, player, team, task, hasProof, q],
  );

  // Initial load + reload whenever a committed filter changes.
  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const toggleCat = (key: string) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const clearFilters = () => {
    setCats(new Set());
    setQ("");
    setActor("");
    setPlayer("");
    setTeam("");
    setTask("");
    setHasProof(false);
  };

  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit))) : 1;

  return (
    <div className="space-y-4">
      <p className="text-osrs-parchment-dark/60 text-sm">
        Every point-affecting and administrative action inside this event — auto credits, pending
        submissions, approvals, manual awards, revokes, roster / team / board / prize / task /
        settings changes — in one filterable timeline.
      </p>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(([key, label]) => {
          const on = cats.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleCat(key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                on
                  ? "border-osrs-gold bg-osrs-gold/20 text-osrs-gold"
                  : "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:bg-osrs-bronze/10"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Field filters */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="player, task, note…"
            className={`${field} w-52`}
          />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Actor user ID</span>
          <input value={actor} onChange={(e) => setActor(e.target.value)} className={`${field} w-28`} />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Player ID</span>
          <input value={player} onChange={(e) => setPlayer(e.target.value)} className={`${field} w-24`} />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Team ID</span>
          <input value={team} onChange={(e) => setTeam(e.target.value)} className={`${field} w-20`} />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Task ID</span>
          <input value={task} onChange={(e) => setTask(e.target.value)} className={`${field} w-20`} />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={hasProof} onChange={(e) => setHasProof(e.target.checked)} />
          <span className="text-osrs-parchment-dark/80">Has screenshot</span>
        </label>
        <button
          type="button"
          onClick={() => load(1)}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            clearFilters();
            // reload with cleared filters on the next tick after state settles
            setTimeout(() => load(1), 0);
          }}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-2 text-sm"
        >
          Clear
        </button>
      </div>

      {error && <div className="text-osrs-red text-sm">{error}</div>}
      {meta?.capped && (
        <div className="text-osrs-gold/80 text-xs">
          This event has more history than one window shows — narrow with filters or search to reach
          older rows.
        </div>
      )}

      {loading && !data ? (
        <div className="text-osrs-parchment-dark/60 p-6 text-center text-sm">Loading…</div>
      ) : data && data.entries.length === 0 ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          No matching audit entries.
        </div>
      ) : (
        <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">When</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">What happened</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Actor</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {data?.entries.map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  expanded={expanded === entry.id}
                  onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && data && data.entries.length > 0 && (
        <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-sm">
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => load(page + 1)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function actorLabel(actor: AuditEntry["actor"]): string {
  if (!actor) return "system";
  return actor.username || actor.discord_id || `#${actor.user_id}`;
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = Boolean(entry.before || entry.after || entry.proof_url);
  const tint = CATEGORY_TINT[entry.category] ?? "text-osrs-parchment-dark/80";
  return (
    <Fragment>
      <tr
        onClick={hasDetail ? onToggle : undefined}
        className={hasDetail ? "hover:bg-osrs-bronze/10 cursor-pointer" : ""}
      >
        <td className="text-osrs-parchment-dark/70 whitespace-nowrap px-3 py-2 tabular-nums">
          {formatRelativeTime(entry.created_at ?? 0)}
        </td>
        <td className={`whitespace-nowrap px-3 py-2 text-xs font-medium ${tint}`}>
          {entry.category.replace(/_/g, " ")}
        </td>
        <td className="px-3 py-2">{entry.summary}</td>
        <td className="whitespace-nowrap px-3 py-2">{actorLabel(entry.actor)}</td>
        <td className="px-3 py-2">
          {entry.proof_url ? (
            <a
              href={entry.proof_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-osrs-gold hover:underline"
            >
              view
            </a>
          ) : (
            <span className="text-osrs-parchment-dark/30">—</span>
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="bg-osrs-brown-dark/40">
          <td colSpan={5} className="px-3 py-3">
            {entry.proof_url && (
              <img
                src={entry.proof_url}
                alt="submission screenshot"
                className="border-osrs-bronze/30 mb-3 max-h-64 rounded border"
              />
            )}
            {(entry.before || entry.after) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-osrs-parchment-dark/50 mb-1 text-xs uppercase">Before</div>
                  <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/20 max-h-48 overflow-auto rounded border p-2 text-xs">
                    {prettyValue(entry.before)}
                  </pre>
                </div>
                <div>
                  <div className="text-osrs-parchment-dark/50 mb-1 text-xs uppercase">After</div>
                  <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/20 max-h-48 overflow-auto rounded border p-2 text-xs">
                    {prettyValue(entry.after)}
                  </pre>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
