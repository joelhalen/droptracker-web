"use client";

/**
 * Manual team placement for a live board-game event: an event admin picks a
 * team and a tile and the piece is put there. The team draws that tile's task
 * the same way a landing does, and its previous task is dropped. Chutes and
 * ladders on the chosen tile are skipped unless "Follow a chute or ladder" is
 * ticked. Required checkpoints and roadblocks are not applied.
 *
 * A move that ends on the finish asks for confirmation first: a plain finish
 * wins the game and ends the event, a finish with a task assigns it. The API
 * enforces this too (409 until resent with confirm_finish).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoardDetail, BoardTile } from "@droptracker/api-types";
import {
  fetchEventBoard,
  moveBoardTeam,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button } from "@/components/ui";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";

const STATUS_LABELS: Record<string, string> = {
  active: "Working on a task",
  awaiting_roll: "Waiting to roll",
  blocked: "Stalled",
  finished: "Finished",
};

/** Where a link on this tile sends a piece that lands on it, or null. Mirrors
 * the engine's tile_jump: a "complete" trigger only holds for ladders. */
function landingLink(tile: BoardTile | undefined, idxs: Set<number>): number | null {
  if (!tile || tile.jump_to == null || tile.jump_to === tile.idx) return null;
  if (!idxs.has(tile.jump_to)) return null;
  const onComplete = tile.jump_when === "complete" && tile.jump_to > tile.idx;
  return onComplete ? null : tile.jump_to;
}

function tileName(tile: BoardTile, finishIdx: number | null | undefined): string {
  const parts = [`Tile ${tile.idx}`];
  if (tile.label) parts.push(tile.label);
  else if (tile.task_label) parts.push(tile.task_label);
  if (tile.idx === finishIdx) parts.push("(finish)");
  else if (tile.idx === 0) parts.push("(start)");
  if (tile.jump_to != null && tile.jump_to !== tile.idx) {
    parts.push(`(${tile.jump_to > tile.idx ? "ladder" : "chute"} to ${tile.jump_to})`);
  }
  return parts.join(" · ");
}

type Pending = { teamId: number; tileIdx: number; hasTask: boolean; message: string };

export function EventBoardTeamMover({
  groupId,
  eventId,
  live,
}: {
  groupId: number | null;
  eventId: number;
  live: boolean;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [tileIdx, setTileIdx] = useState<number | null>(null);
  const [followLinks, setFollowLinks] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await fetchEventBoard(groupId, eventId));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load the board."));
    }
  }, [groupId, eventId]);

  useEffect(() => {
    if (live) void load();
  }, [live, load]);

  const tiles = useMemo(
    () => [...(board?.tiles ?? [])].sort((a, b) => a.idx - b.idx),
    [board],
  );
  const byIdx = useMemo(() => new Map(tiles.map((t) => [t.idx, t])), [tiles]);
  const idxs = useMemo(() => new Set(tiles.map((t) => t.idx)), [tiles]);
  const positions = board?.positions ?? [];
  const finishIdx = board?.finish_idx ?? null;
  const team = positions.find((p) => p.team_id === teamId) ?? null;

  if (!live) {
    return (
      <p className="text-osrs-parchment-dark/60 text-xs">
        Teams can be moved once the event is live.
      </p>
    );
  }

  const send = async (tId: number, idx: number, confirmFinish: boolean) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await moveBoardTeam(groupId, eventId, tId, {
        tileIdx: idx,
        followLinks,
        confirmFinish,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        if (res.finishConfirm) {
          setPending({ teamId: tId, tileIdx: idx, hasTask: res.finishConfirm.hasTask, message: res.message });
        } else {
          setError(res.message);
        }
        return;
      }
      setPending(null);
      const r = res.result;
      const name = r.team_name ?? "The team";
      const bits = [`${name} moved from tile ${r.from} to tile ${r.to}.`];
      if (r.jump) bits.push(`Took the ${r.jump.kind} from tile ${r.jump.from}.`);
      if (r.won) bits.push("They reached the finish and won. The event has ended.");
      else if (r.task_label) bits.push(`New task: ${r.task_label}.`);
      else bits.push("No task on that tile, so they can roll.");
      setNote(bits.join(" "));
      setReason("");
      if (r.won) router.refresh();
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't move the team."));
    } finally {
      setBusy(false);
    }
  };

  const onMove = () => {
    if (teamId == null || tileIdx == null) return;
    const link = followLinks ? landingLink(byIdx.get(tileIdx), idxs) : null;
    const landing = link ?? tileIdx;
    if (finishIdx != null && landing >= finishIdx) {
      const finishTile = byIdx.get(landing);
      const hasTask = Boolean(finishTile?.task_id || finishTile?.difficulty);
      setPending({
        teamId,
        tileIdx,
        hasTask,
        message: hasTask
          ? "That puts the team on the finish tile. They will need to complete its task to win."
          : "That puts the team on the finish tile. It has no task, so the team wins and the event ends.",
      });
      return;
    }
    void send(teamId, tileIdx, false);
  };

  return (
    <div className="border-osrs-bronze/20 space-y-3 rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-osrs-gold text-xs font-semibold">Move a team</h4>
        <button
          type="button"
          onClick={() => void load()}
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-[11px] underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-osrs-parchment-dark/60 text-[11px]">
        Put a team's piece on any tile. They get that tile's task and lose the one they were
        working on. Required tiles and roadblocks are skipped. Moves are recorded in the audit log.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
      {note && <Alert variant="success">{note}</Alert>}

      {board && positions.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-xs">No teams are on the board yet.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Team</span>
            <select
              value={teamId ?? ""}
              onChange={(e) => {
                setPending(null);
                setTeamId(e.target.value ? Number(e.target.value) : null);
              }}
              className={`${field} w-48`}
            >
              <option value="">Pick a team</option>
              {positions.map((p) => (
                <option key={p.team_id} value={p.team_id} disabled={p.status === "finished"}>
                  {p.team_name} (tile {p.tile_idx})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Tile</span>
            <select
              value={tileIdx ?? ""}
              onChange={(e) => {
                setPending(null);
                setTileIdx(e.target.value ? Number(e.target.value) : null);
              }}
              className={`${field} w-72 max-w-full`}
            >
              <option value="">Pick a tile</option>
              {tiles.map((t) => (
                <option key={t.idx} value={t.idx} disabled={team?.tile_idx === t.idx}>
                  {tileName(t, finishIdx)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1 text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Reason (optional)</span>
            <input
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shown in the audit log"
              className={`${field} w-full`}
            />
          </label>
        </div>
      )}

      {team && (
        <p className="text-osrs-parchment-dark/70 text-[11px]">
          {team.team_name} is on tile {team.tile_idx}. {STATUS_LABELS[team.status] ?? team.status}
          {team.current_task ? `: ${team.current_task.label}` : ""}.
        </p>
      )}

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={followLinks}
          onChange={(e) => {
            setPending(null);
            setFollowLinks(e.target.checked);
          }}
        />
        Follow a chute or ladder on that tile
      </label>

      {pending ? (
        <div className="border-osrs-gold/40 bg-osrs-gold/5 space-y-2 rounded border p-3">
          <p className="text-sm">{pending.message}</p>
          <div className="flex gap-2">
            <Button
              variant={pending.hasTask ? "primary" : "danger"}
              size="sm"
              disabled={busy}
              onClick={() => void send(pending.teamId, pending.tileIdx, true)}
            >
              {pending.hasTask ? "Move to the finish" : "Move and end the event"}
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          size="sm"
          disabled={busy || teamId == null || tileIdx == null || team?.tile_idx === tileIdx}
          onClick={onMove}
        >
          {busy ? "Moving…" : "Move team"}
        </Button>
      )}
    </div>
  );
}
