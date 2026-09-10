"use client";

/**
 * Board-game designer (web44a): lay out the dice track on a custom board
 * image by clicking to place tiles, then give each tile a difficulty (the
 * default — the tile rolls a random pool task of that tier per landing) or
 * pin one specific task.
 *
 * Autosave is the bingo designer's proven block, cloned: edits mark the
 * board dirty and a 1500 ms debounce PUTs the whole layout; a 30 s sweep
 * retries missed saves; closing the tile editor flushes immediately; a
 * revision guard prevents an in-flight response from clobbering newer edits.
 *
 * Tile rendering follows settings.tile_render (rune icon per difficulty /
 * invisible hotspots / configurable outline) so the designer previews
 * exactly what players will see.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BoardDetail,
  BoardInput,
  BoardSettings,
  BoardStyle,
  BoardTile,
  EventDetail,
  EventTask,
  EventTaskDifficulty,
} from "@droptracker/api-types";
import { BOARD_STYLES, EVENT_TASK_DIFFICULTIES } from "@droptracker/api-types";
import {
  fetchEventBoard,
  generateEventBoard,
  saveEventBoard,
  saveEventBoardSettings,
  updateEventTeam,
  uploadEventBoardBackground,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { TASK_DIFFICULTY_LABELS } from "@/lib/events";
import { Alert } from "@/components/ui";
import { BoundTaskPanel, EventTaskCombobox } from "@/components/event-task-search";
import { ItemDbIcon } from "@/components/item-db-icon";
import { QuantityInput } from "@/components/quantity-input";
import { BoardLinksOverlay } from "@/components/board-links-overlay";
import { relinkAfterDelete, suggestLinks, validateBoardLinks } from "@/lib/board-links";
import type { LinkTile } from "@/lib/board-links";

/** Elemental rune item ids — the tile icons in "rune" render mode. */
export const RUNE_ITEM_IDS: Record<EventTaskDifficulty, number> = {
  air: 556,
  water: 555,
  earth: 557,
  fire: 554,
};

/** The bundled 100-tile zig-zag board art (static /img tree) — its tile
 * circles line up exactly with zigzagTiles(100). */
const SAMPLE_BOARD = {
  url: "https://www.droptracker.io/img/events/board-default.png",
  width: 1600,
  height: 1600,
};

// Plain difficulty names (the stored values remain the legacy rune elements).
const DIFFICULTY_LABELS = TASK_DIFFICULTY_LABELS;

type DesignerTile = {
  x: number;
  y: number;
  label: string;
  difficulty: EventTaskDifficulty | null;
  taskId: number | null;
  tileKind: "start" | "normal" | "required" | "finish";
  /** Chute / ladder target (2026-09); null = no link. */
  jumpTo: number | null;
  /** Ladders only: climb on landing, or once the tile's task is completed. */
  jumpWhen: "land" | "complete";
};

const STYLE_LABELS: Record<BoardStyle, string> = {
  race: "Race",
  chutes_ladders: "Chutes & Ladders",
};

/** The pure-rules view of the layout (lib/board-links). */
function linkTiles(list: DesignerTile[]): LinkTile[] {
  return list.map((t, i) => ({
    idx: i,
    tileKind: t.tileKind,
    jumpTo: t.jumpTo,
    jumpWhen: t.jumpWhen,
    hasTask: t.taskId != null || t.difficulty != null,
  }));
}

const cycleDifficulty = (i: number): EventTaskDifficulty =>
  EVENT_TASK_DIFFICULTIES[i % EVENT_TASK_DIFFICULTIES.length] ?? "air";

/** Serpentine default layout: N tiles zig-zagging down the image. */
function zigzagTiles(count: number): DesignerTile[] {
  const cols = 10;
  const rows = Math.ceil(count / cols);
  const tiles: DesignerTile[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const within = i % cols;
    const col = row % 2 === 0 ? within : cols - 1 - within; // snake
    tiles.push({
      x: 0.06 + (col * 0.88) / (cols - 1),
      y: 0.08 + (rows > 1 ? (row * 0.84) / (rows - 1) : 0),
      label: "",
      difficulty: cycleDifficulty(i),
      taskId: null,
      tileKind: i === 0 ? "start" : i === count - 1 ? "finish" : "normal",
      jumpTo: null,
      jumpWhen: "land",
    });
  }
  return tiles;
}

function tilesFromBoard(board: BoardDetail): DesignerTile[] {
  return board.tiles.map((t: BoardTile) => ({
    x: t.x,
    y: t.y,
    label: t.label ?? "",
    difficulty: (t.difficulty as EventTaskDifficulty | null) ?? null,
    taskId: t.task_id ?? null,
    tileKind: t.tile_kind,
    jumpTo: t.jump_to ?? null,
    jumpWhen: t.jump_when === "complete" ? "complete" : "land",
  }));
}

export function EventBoardDesigner({
  groupId,
  event,
  tasks,
  onSaved,
  onTaskUpdated,
}: {
  groupId: number | null;
  event: EventDetail;
  tasks: EventTask[];
  onSaved?: (board: BoardDetail) => void;
  /** A task edited from inside the tile editor. The layout is untouched —
   * only the parent's task list needs the update. */
  onTaskUpdated?: (task: EventTask) => void;
}) {
  // Deliberately stricter than the bingo board's live-edit unlock (web68a):
  // piece positions reference tiles, so replacing the layout mid-game would
  // strand pieces. Board *settings* stay live-tunable in their own panel.
  const editable = event.status === "draft";
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [tiles, setTiles] = useState<DesignerTile[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">(
    "idle",
  );

  // --- Procedural generator (web46a) ---------------------------------------
  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  // The seed string used by the most recent roll this session (""=random,
  // null=nothing rolled yet). Drives the "Regenerate" label and the
  // same-seed-produces-an-identical-board warning.
  const [lastGenSeed, setLastGenSeed] = useState<string | null>(null);
  const [gen, setGen] = useState<{
    seed: string;
    regions: number;
    tiles: number;
    style: "path" | "filled" | "grid";
  }>({ seed: "", regions: 8, tiles: 60, style: "path" });
  // --- Chutes & ladders (2026-09) -------------------------------------------
  // Pick-on-board: the tile whose link target the next tile click sets.
  const [linkPickFor, setLinkPickFor] = useState<number | null>(null);
  const [linksOpen, setLinksOpen] = useState(false);
  const [linkGen, setLinkGen] = useState({ ladders: 5, chutes: 5, minSpan: 8 });
  const [styleBusy, setStyleBusy] = useState(false);

  // --- Autosave plumbing (the bingo designer's block, verbatim pattern) ----
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const boardRef = useRef(board);
  boardRef.current = board;

  const schedule = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), 1500);
  };
  const markDirty = () => {
    revRef.current += 1;
    setSaveState("dirty");
    schedule();
  };

  // --- Undo / redo over the tiles array ------------------------------------
  // Explicit snapshots taken BEFORE each user mutation (add / drag / edit /
  // delete / auto-set / seed / remove-all). Non-user replacements (initial
  // load, post-flush server adoption, generate) never push here, so the stack
  // can't be corrupted; generate + initial load also reset it outright.
  const HISTORY_CAP = 50;
  const undoStack = useRef<DesignerTile[][]>([]);
  const redoStack = useRef<DesignerTile[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHistoryFlags = () => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  };
  /** Push the pre-mutation tiles onto the undo stack. Defaults to the current
   * tiles; pass an explicit snapshot for drags (captured on mousedown). */
  const pushHistory = (snapshot: DesignerTile[] = tilesRef.current) => {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > HISTORY_CAP) undoStack.current.shift();
    redoStack.current = [];
    syncHistoryFlags();
  };
  const clearHistory = () => {
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryFlags();
  };
  const undo = () => {
    if (!editable || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(tilesRef.current);
    setTiles(prev);
    setSelected(null);
    // CRITICAL: bump revRef via markDirty or the autosave guard no-ops the
    // undo (flush() early-returns when revRef === savedRevRef).
    markDirty();
    syncHistoryFlags();
  };
  const redo = () => {
    if (!editable || redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(tilesRef.current);
    setTiles(next);
    setSelected(null);
    markDirty();
    syncHistoryFlags();
  };

  const buildInput = (): BoardInput => ({
    // Background rides along so "use the sample board" persists with the
    // same autosave that persists the tiles it seeded.
    ...(boardRef.current?.background_url
      ? {
          background_url: boardRef.current.background_url,
          bg_width: boardRef.current.bg_width ?? null,
          bg_height: boardRef.current.bg_height ?? null,
        }
      : {}),
    tiles: tilesRef.current.map((t, idx) => ({
      idx,
      x: Math.round(t.x * 10000) / 10000,
      y: Math.round(t.y * 10000) / 10000,
      ...(t.label.trim() ? { label: t.label.trim() } : {}),
      ...(t.taskId != null
        ? { task_id: t.taskId }
        : t.difficulty
          ? { difficulty: t.difficulty }
          : {}),
      tile_kind: t.tileKind,
      ...(t.jumpTo != null
        ? {
            jump_to: t.jumpTo,
            ...(t.jumpWhen === "complete" && t.jumpTo > idx
              ? { jump_when: "complete" as const }
              : {}),
          }
        : {}),
    })),
  });

  const flush = async () => {
    if (!editable || savingRef.current) return;
    if (revRef.current === savedRevRef.current) return;
    // The backend refuses an invalid link set (422); surface the same rule
    // here, next to the board, instead of a bare "Autosave failed".
    const problems = validateBoardLinks(linkTiles(tilesRef.current));
    if (problems.length > 0) {
      setError(`Fix the links before the board can save: ${problems[0]}`);
      setSaveState("error");
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    const rev = revRef.current;
    try {
      const detail = await saveEventBoard(groupId, event.id, buildInput());
      savedRevRef.current = rev;
      setError(null);
      if (revRef.current === rev && selectedRef.current == null) {
        setBoard(detail);
        setTiles(tilesFromBoard(detail));
        setSaveState("saved");
      } else {
        setSaveState("dirty");
        schedule();
      }
      onSaved?.(detail);
    } catch (err) {
      setError(getErrorMessage(err, "Autosave failed."));
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };
  flushRef.current = flush;

  useEffect(() => {
    const sweep = setInterval(() => {
      if (saveState === "dirty" && !savingRef.current) flushRef.current();
    }, 30_000);
    return () => clearInterval(sweep);
  }, [saveState]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // --- Initial load ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    fetchEventBoard(groupId, event.id)
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
        setTiles(tilesFromBoard(b));
        clearHistory(); // fresh board load starts with an empty undo stack
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Couldn't load the board.")));
    return () => {
      cancelled = true;
    };
  }, [groupId, event.id]);

  // --- Board interactions ----------------------------------------------------
  const imgRef = useRef<HTMLDivElement | null>(null);
  const dragIdx = useRef<number | null>(null);

  const fractionAt = (e: React.MouseEvent): { x: number; y: number } | null => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  };

  const onBoardClick = (e: React.MouseEvent) => {
    if (!editable) return;
    if (dragIdx.current != null) return; // drag end, not a place
    if (linkPickFor != null) {
      // Clicking empty board while picking a link target = cancel the pick.
      setLinkPickFor(null);
      return;
    }
    const pos = fractionAt(e);
    if (!pos) return;
    pushHistory();
    setTiles((prev) => {
      const next = [
        ...prev,
        {
          ...pos,
          label: "",
          difficulty: cycleDifficulty(prev.length),
          taskId: null,
          tileKind: prev.length === 0 ? ("start" as const) : ("normal" as const),
          jumpTo: null,
          jumpWhen: "land" as const,
        },
      ];
      return next;
    });
    setSelected(tiles.length);
    markDirty();
  };

  const onTileMouseDown = (idx: number) => (e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    dragIdx.current = null;
    // Snapshot the layout BEFORE any drag movement; pushed once on mouseup if
    // the pointer actually moved (a plain click never mutates tiles).
    const beforeDrag = tilesRef.current;
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 4) return;
      dragIdx.current = idx;
      const el = imgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      setTiles((prev) => prev.map((t, i) => (i === idx ? { ...t, x, y } : t)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (dragIdx.current != null) {
        pushHistory(beforeDrag);
        markDirty();
        // Let the click handler see "this was a drag" then clear.
        setTimeout(() => {
          dragIdx.current = null;
        }, 0);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const updateTile = (idx: number, patch: Partial<DesignerTile>) => {
    pushHistory();
    setTiles((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    markDirty();
  };

  const deleteTile = (idx: number) => {
    pushHistory();
    // The track re-indexes, so every link past the removed tile shifts down
    // and a link INTO it dies.
    setTiles((prev) => relinkAfterDelete(prev.filter((_, i) => i !== idx), idx));
    setSelected(null);
    setLinkPickFor(null);
    markDirty();
  };

  // --- Chutes & ladders tools (2026-09) --------------------------------------
  const linkProblems = useMemo(() => validateBoardLinks(linkTiles(tiles)), [tiles]);
  const linkCount = tiles.filter((t) => t.jumpTo != null).length;
  const isChutes = board?.settings.style === "chutes_ladders";

  const setStyle = async (style: BoardStyle) => {
    if (!board || style === board.settings.style) return;
    setStyleBusy(true);
    setError(null);
    try {
      const settings = await saveEventBoardSettings(groupId, event.id, { style });
      setBoard((prev) => (prev ? { ...prev, settings } : prev));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't change the board style."));
    } finally {
      setStyleBusy(false);
    }
  };

  const placeLinks = () => {
    const placed = suggestLinks(linkTiles(tiles), {
      ladders: linkGen.ladders,
      chutes: linkGen.chutes,
      minSpan: linkGen.minSpan,
    });
    if (placed.size === 0) {
      setError(
        "No room for more links with those settings — lower the minimum span, add tiles, or clear some links.",
      );
      return;
    }
    setError(null);
    pushHistory();
    setTiles((prev) =>
      prev.map((t, i) =>
        placed.has(i) ? { ...t, jumpTo: placed.get(i)!, jumpWhen: "land" as const } : t,
      ),
    );
    markDirty();
  };

  const clearLinks = () => {
    if (linkCount === 0) return;
    if (!window.confirm(`Remove all ${linkCount} chute(s) and ladder(s) from this board?`)) return;
    pushHistory();
    setTiles((prev) =>
      prev.map((t) => (t.jumpTo != null ? { ...t, jumpTo: null, jumpWhen: "land" as const } : t)),
    );
    setLinkPickFor(null);
    markDirty();
  };

  const closeEditor = () => {
    setSelected(null);
    flushRef.current();
  };

  // "Auto-set tile type": easy→medium→hard→elite cycling across all tiles.
  const autoSetTileTypes = () => {
    const mismatched = tiles.filter(
      (t, i) => t.taskId != null || (t.difficulty && t.difficulty !== cycleDifficulty(i)),
    ).length;
    if (
      mismatched > 0 &&
      !window.confirm(
        `Auto-set will overwrite the difficulty on ${mismatched} tile(s) ` +
          "(easy → medium → hard → elite, repeating). Pinned tasks are unpinned. Continue?",
      )
    ) {
      return;
    }
    pushHistory();
    setTiles((prev) =>
      prev.map((t, i) => ({ ...t, difficulty: cycleDifficulty(i), taskId: null })),
    );
    markDirty();
  };

  const seedZigzag = () => {
    if (
      tiles.length > 0 &&
      !window.confirm(`Replace the current ${tiles.length} tile(s) with a fresh 100-tile zig-zag layout?`)
    ) {
      return;
    }
    pushHistory();
    // No custom art yet → drop in the bundled sample board (its printed
    // tiles line up with this exact layout).
    setBoard((prev) =>
      prev && !prev.background_url
        ? {
            ...prev,
            background_url: SAMPLE_BOARD.url,
            bg_width: SAMPLE_BOARD.width,
            bg_height: SAMPLE_BOARD.height,
          }
        : prev,
    );
    setTiles(zigzagTiles(100));
    setSelected(null);
    markDirty();
  };

  const removeAll = () => {
    if (!editable || tiles.length === 0) return;
    if (
      !window.confirm(
        `Remove all ${tiles.length} tiles from this board? This cannot be undone except via Undo.`,
      )
    ) {
      return;
    }
    pushHistory();
    setTiles([]);
    setSelected(null);
    markDirty();
  };

  // Keyboard: Ctrl/Cmd+Z = undo, Ctrl+Y or Ctrl/Cmd+Shift+Z = redo. Ignored
  // while typing in the tile editor (or any editable field) and mid-drag.
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el.isContentEditable)
          return;
      }
      if (dragIdx.current != null) return; // don't fight an in-progress drag
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // undo/redo only touch refs + stable setters, so the mount-time closures
    // stay correct; re-subscribe only when editability flips.
  }, [editable]);

  // Procedurally roll a whole board (art + sequential tile track) server-side.
  // The result is already persisted, so we sync the autosave revision and
  // adopt the returned board rather than marking dirty.
  const trimmedGenSeed = gen.seed.trim();
  // Re-rolling with the same explicit seed reproduces the identical board.
  const sameSeedRepeat =
    lastGenSeed !== null && trimmedGenSeed !== "" && trimmedGenSeed === lastGenSeed;

  const generateBoard = async () => {
    // One confirmation, whichever matters most: an identical-board warning when
    // the seed hasn't changed, otherwise the destructive-replace warning.
    let confirmMsg = "";
    if (sameSeedRepeat) {
      confirmMsg =
        `The seed is still ${trimmedGenSeed} — regenerating with the same seed produces the ` +
        `exact same board. Change or clear the seed for a different one. Regenerate anyway?`;
    } else if (tiles.length > 0) {
      confirmMsg =
        `Replace the current ${tiles.length} tile(s) and background with a freshly generated board?`;
    }
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setGenerating(true);
    setError(null);
    try {
      const detail = await generateEventBoard(groupId, event.id, {
        seed: trimmedGenSeed ? Number(trimmedGenSeed) : null,
        regions: gen.regions,
        tiles: gen.tiles,
        style: gen.style,
        ...(gen.style === "grid" ? { title: "Chutes & Ladders", subtitle: event.name } : {}),
      });
      // Panel intentionally stays open so the admin can re-roll until happy.
      adoptGenerated(detail, trimmedGenSeed); // remember what we rolled with ("" = random)
    } catch (err) {
      setError(getErrorMessage(err, "Board generation failed."));
    } finally {
      setGenerating(false);
    }
  };

  /** A server-generated board is already persisted: adopt it and sync the
   * autosave revision so nothing re-PUTs it; a fresh board is a clean slate
   * for undo and any half-made link pick. */
  const adoptGenerated = (detail: BoardDetail, seedUsed: string) => {
    setBoard(detail);
    setTiles(tilesFromBoard(detail));
    setSelected(null);
    setLinkPickFor(null);
    clearHistory();
    savedRevRef.current = revRef.current;
    setSaveState("saved");
    setLastGenSeed(seedUsed);
    onSaved?.(detail);
  };

  // The Chutes & Ladders preset: the classic 10×10 numbered grid (art +
  // 100 tiles reading bottom-left to top), ready for links.
  const generateGrid = async () => {
    if (
      tiles.length > 0 &&
      !window.confirm(
        `Replace the current ${tiles.length} tile(s) and background with a fresh 10×10 numbered grid?`,
      )
    ) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const detail = await generateEventBoard(groupId, event.id, {
        seed: null,
        tiles: 100,
        style: "grid",
        title: "Chutes & Ladders",
        subtitle: event.name,
      });
      adoptGenerated(detail, "");
    } catch (err) {
      setError(getErrorMessage(err, "Board generation failed."));
    } finally {
      setGenerating(false);
    }
  };

  // --- Background upload -----------------------------------------------------
  const [uploading, setUploading] = useState(false);
  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await uploadEventBoardBackground(groupId, event.id, form);
      setBoard((prev) => (prev ? { ...prev, ...res } : prev));
    } catch (err) {
      setError(getErrorMessage(err, "Background upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const render = board?.settings.tile_render;
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const aspect =
    board?.bg_width && board?.bg_height ? board.bg_width / board.bg_height : 16 / 10;

  if (!board) {
    return (
      <div className="text-osrs-parchment-dark/60 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : "Loading the board…"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {!editable && (
        <p className="text-osrs-parchment-dark/60 text-xs">
          The board layout is locked while the event is live — settings below stay editable.
        </p>
      )}

      <BoardStylePicker value={board.settings.style} busy={styleBusy} onChange={setStyle} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark cursor-pointer rounded px-3 py-1.5 text-sm font-medium">
          {uploading ? "Uploading…" : board.background_url ? "Replace image" : "Upload board image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={!editable || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setGenOpen((v) => !v)}
          disabled={!editable}
          className="border-osrs-gold/60 text-osrs-gold hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          aria-expanded={genOpen}
          title="Procedurally generate a whole board — art and the tile track"
        >
          ✨ Generate board
        </button>
        {isChutes && (
          <>
            <button
              type="button"
              onClick={generateGrid}
              disabled={!editable || generating}
              className="border-osrs-gold/60 text-osrs-gold hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              title="Generate the classic 10×10 numbered grid — art and 100 tiles"
            >
              🪜 10×10 grid
            </button>
            <button
              type="button"
              onClick={() => setLinksOpen((v) => !v)}
              disabled={!editable || tiles.length < 10}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
              aria-expanded={linksOpen}
              title="Place a set of chutes and ladders at random (needs at least 10 tiles)"
            >
              Add ladders &amp; chutes
            </button>
            <button
              type="button"
              onClick={clearLinks}
              disabled={!editable || linkCount === 0}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Clear links
            </button>
          </>
        )}
        <button
          type="button"
          onClick={seedZigzag}
          disabled={!editable}
          className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Zig-zag 100 tiles
        </button>
        <button
          type="button"
          onClick={autoSetTileTypes}
          disabled={!editable || tiles.length === 0}
          className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Cycle easy → medium → hard → elite across every tile in order"
        >
          Auto-set tile type
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!editable || !canUndo}
          className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!editable || !canRedo}
          className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          ↷ Redo
        </button>
        <button
          type="button"
          onClick={removeAll}
          disabled={!editable || tiles.length === 0}
          className="border-osrs-red/40 text-osrs-red/90 hover:border-osrs-red hover:bg-osrs-red/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Remove every tile from the board (undoable)"
        >
          Remove all
        </button>
        <span className="text-osrs-parchment-dark/60 ml-auto text-xs">
          {tiles.length} tile{tiles.length === 1 ? "" : "s"}
        </span>
        <SaveStatus state={saveState} onSave={() => flushRef.current()} />
      </div>

      {genOpen && editable && (
        <div className="border-osrs-gold/30 bg-osrs-brown-dark/40 space-y-3 rounded border p-3">
          <h4 className="text-osrs-gold text-sm font-semibold">Procedural board generator</h4>
          <p className="text-osrs-parchment-dark/60 text-xs">
            Rolls a full board — winding path art plus every tile placed in order (start → finish,
            difficulty cycling easy → medium → hard → elite). Replaces the current layout and
            background; you can still edit any tile afterward.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Seed (blank = random)</span>
              <input
                type="number"
                value={gen.seed}
                placeholder="random"
                onChange={(e) => setGen((g) => ({ ...g, seed: e.target.value }))}
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Tiles (10–400)</span>
              <QuantityInput
                min={10}
                max={400}
                value={gen.tiles}
                onChange={(tiles) => setGen((g) => ({ ...g, tiles }))}
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              />
            </label>
            {gen.style !== "grid" && (
              <label className="block text-sm">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Regions (2–11)</span>
                <QuantityInput
                  min={2}
                  max={11}
                  value={gen.regions}
                  onChange={(regions) => setGen((g) => ({ ...g, regions }))}
                  className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Style</span>
              <select
                value={gen.style}
                onChange={(e) =>
                  setGen((g) => ({ ...g, style: e.target.value as "path" | "filled" | "grid" }))
                }
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              >
                <option value="path">Path (winding track)</option>
                <option value="filled">Filled (dense map)</option>
                <option value="grid">Numbered grid (Chutes &amp; Ladders)</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateBoard}
              disabled={generating}
              className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold/90 rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {generating
                ? "Generating…"
                : lastGenSeed === null
                  ? "Generate board"
                  : "🎲 Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setGenOpen(false)}
              disabled={generating}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-xs disabled:opacity-50"
            >
              {lastGenSeed === null ? "Cancel" : "Close"}
            </button>
            {sameSeedRepeat ? (
              <span className="text-osrs-red/90 text-xs">
                ⚠ Same seed as the last roll — you'll get an identical board. Clear or change
                the seed for a new one.
              </span>
            ) : (
              <span className="text-osrs-parchment-dark/50 text-xs">
                {lastGenSeed === null
                  ? "Generates exactly the tile count you enter. Don't like it? Re-roll — the panel stays open."
                  : "Re-roll for a new board (blank seed = a fresh one each time)."}
              </span>
            )}
          </div>
        </div>
      )}

      {linksOpen && editable && isChutes && (
        <div className="border-osrs-gold/30 bg-osrs-brown-dark/40 space-y-3 rounded border p-3">
          <h4 className="text-osrs-gold text-sm font-semibold">Add ladders &amp; chutes</h4>
          <p className="text-osrs-parchment-dark/60 text-xs">
            Places new links at random on normal tiles — never on the start, the finish or a
            required tile — and keeps the ones you already have. Links never chain, and a ladder
            never skips a required tile. Every link stays editable from its tile afterward.
          </p>
          <div className="grid max-w-md grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ladders</span>
              <QuantityInput
                min={0}
                max={50}
                value={linkGen.ladders}
                onChange={(ladders) => setLinkGen((g) => ({ ...g, ladders }))}
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Chutes</span>
              <QuantityInput
                min={0}
                max={50}
                value={linkGen.chutes}
                onChange={(chutes) => setLinkGen((g) => ({ ...g, chutes }))}
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Min. span (tiles)</span>
              <QuantityInput
                min={1}
                max={99}
                value={linkGen.minSpan}
                onChange={(minSpan) => setLinkGen((g) => ({ ...g, minSpan }))}
                className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={placeLinks}
              className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold/90 rounded px-3 py-1.5 text-sm font-semibold"
            >
              Place links
            </button>
            <button
              type="button"
              onClick={() => setLinksOpen(false)}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-xs"
            >
              Close
            </button>
            <span className="text-osrs-parchment-dark/50 text-xs">
              {linkCount} link{linkCount === 1 ? "" : "s"} on the board
            </span>
          </div>
        </div>
      )}

      {linkProblems.length > 0 && (
        <Alert variant="error">
          <span className="block text-xs font-semibold">Fix these before the board can save:</span>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {linkProblems.slice(0, 5).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* The board surface */}
      <div
        ref={imgRef}
        onClick={onBoardClick}
        className="border-osrs-bronze/30 relative w-full overflow-hidden rounded border bg-black/30 select-none"
        style={{ aspectRatio: `${aspect}` }}
        role="application"
        aria-label={
          linkPickFor != null
            ? `Board designer — click the tile that tile ${linkPickFor} should link to`
            : "Board designer — click to place a tile"
        }
      >
        {board.background_url ? (
          <img
            src={board.background_url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            draggable={false}
          />
        ) : (
          <div className="text-osrs-parchment-dark/40 pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            Upload a board image, or use the zig-zag layout on a plain background.
          </div>
        )}
        <BoardLinksOverlay
          tiles={tiles.map((t, i) => ({
            idx: i,
            x: t.x,
            y: t.y,
            jump_to: t.jumpTo,
            jump_when: t.jumpWhen,
          }))}
          width={board.bg_width ?? 1600}
          height={board.bg_height ?? 1000}
          highlight={selected}
        />
        {linkPickFor != null && (
          <div className="text-osrs-gold pointer-events-none absolute inset-x-0 top-0 z-30 bg-black/75 px-3 py-1.5 text-center text-xs">
            Click the tile that tile {linkPickFor} should link to — click the board to cancel.
          </div>
        )}
        {tiles.map((t, i) => (
          <TileMarker
            key={i}
            tile={t}
            idx={i}
            renderMode={render?.mode ?? "rune"}
            outlineWidth={render?.outline_width ?? 2}
            outlineColor={render?.outline_color ?? "#ffcc33"}
            iconSize={render?.icon_size ?? 20}
            selected={selected === i}
            editable={editable}
            onMouseDown={onTileMouseDown(i)}
            onClick={(e) => {
              e.stopPropagation();
              if (dragIdx.current != null) return;
              if (linkPickFor != null) {
                if (i !== linkPickFor) updateTile(linkPickFor, { jumpTo: i });
                setLinkPickFor(null);
                return;
              }
              setSelected((prev) => (prev === i ? null : i));
            }}
          />
        ))}
      </div>

      {selected != null && tiles[selected] && (
        <TileEditor
          // Keyed by tile so switching tiles resets the editor's own UI state
          // (task search box, open task form) instead of carrying it over.
          key={selected}
          groupId={groupId}
          eventId={event.id}
          tile={tiles[selected]}
          idx={selected}
          count={tiles.length}
          tasks={tasks}
          taskById={taskById}
          editable={editable}
          // The LAYOUT locks once the game starts, but the tasks it points at
          // stay editable until the event is a frozen record.
          taskEditable={event.status !== "past"}
          liveEvent={event.status === "active"}
          onChange={(patch) => updateTile(selected, patch)}
          onTaskUpdated={onTaskUpdated}
          onDelete={() => deleteTile(selected)}
          onClose={closeEditor}
          picking={linkPickFor === selected}
          onPickOnBoard={() => setLinkPickFor((cur) => (cur === selected ? null : selected))}
        />
      )}

      <BoardSettingsSection
        groupId={groupId}
        event={event}
        settings={board.settings}
        onSaved={(settings) => setBoard((prev) => (prev ? { ...prev, settings } : prev))}
      />

      <GamePiecesSection groupId={groupId} event={event} />
    </div>
  );
}

function SaveStatus({
  state,
  onSave,
}: {
  state: "idle" | "dirty" | "saving" | "saved" | "error";
  onSave: () => void;
}) {
  return (
    <span className="flex items-center gap-2 text-xs">
      {state === "saving" && <span className="text-osrs-parchment-dark/60">Saving…</span>}
      {state === "saved" && <span className="text-osrs-green">All changes saved ✓</span>}
      {state === "error" && <span className="text-osrs-red">Autosave failed</span>}
      {(state === "dirty" || state === "error") && (
        <button
          type="button"
          onClick={onSave}
          className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-2 py-1"
        >
          Save now
        </button>
      )}
    </span>
  );
}

function TileMarker({
  tile,
  idx,
  renderMode,
  outlineWidth,
  outlineColor,
  iconSize,
  selected,
  editable,
  onMouseDown,
  onClick,
}: {
  tile: DesignerTile;
  idx: number;
  renderMode: "rune" | "invisible" | "outline";
  outlineWidth: number;
  outlineColor: string;
  iconSize: number;
  selected: boolean;
  editable: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const isEndpoint = tile.tileKind === "start" || tile.tileKind === "finish";
  const isRequired = tile.tileKind === "required";
  // Only difficulty tiles in "rune" mode actually render a rune icon; the
  // circle grows with the icon so the ring stays proportional. Everything
  // else (endpoints, invisible/outline hotspots) keeps the fixed 32px circle.
  const showsRune = renderMode === "rune" && !!tile.difficulty && tile.taskId == null;
  const dim = showsRune ? iconSize + 12 : 32;
  const base =
    "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold";
  // In the designer, invisible tiles still show a faint hotspot so they can
  // be selected — players see nothing (event-board-view renders them empty).
  const style: React.CSSProperties = {
    left: `${tile.x * 100}%`,
    top: `${tile.y * 100}%`,
    width: dim,
    height: dim,
    cursor: editable ? "grab" : "pointer",
  };
  if (renderMode === "outline" || isEndpoint) {
    style.border = `${outlineWidth}px solid ${isEndpoint ? "#ffd700" : outlineColor}`;
  } else if (renderMode === "invisible") {
    style.border = "1px dashed rgba(255,255,255,0.25)";
  }
  // A required stop wears a red ring in every render mode — the checkpoint
  // has to be visible to be fair.
  if (isRequired) style.border = `${Math.max(2, outlineWidth)}px solid #e05c4d`;
  if (selected) style.boxShadow = "0 0 0 3px rgba(255, 215, 0, 0.7)";
  const linkNote =
    tile.jumpTo != null
      ? tile.jumpTo > idx
        ? ` — ladder to ${tile.jumpTo}`
        : ` — chute to ${tile.jumpTo}`
      : "";

  return (
    <button
      type="button"
      className={`${base} bg-black/45 text-white hover:bg-black/70`}
      style={style}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title={`Tile ${idx}${isRequired ? " (required stop)" : ""}${linkNote}${
        tile.label ? ` — ${tile.label}` : ""
      }`}
    >
      {showsRune ? (
        <ItemDbIcon itemId={RUNE_ITEM_IDS[tile.difficulty!]} size={iconSize} />
      ) : (
        <span>{tile.tileKind === "start" ? "S" : tile.tileKind === "finish" ? "F" : idx}</span>
      )}
    </button>
  );
}

function TileEditor({
  groupId,
  eventId,
  tile,
  idx,
  count,
  tasks,
  taskById,
  editable,
  taskEditable,
  liveEvent,
  onChange,
  onTaskUpdated,
  onDelete,
  onClose,
  picking,
  onPickOnBoard,
}: {
  groupId: number | null;
  eventId: number;
  tile: DesignerTile;
  idx: number;
  count: number;
  tasks: EventTask[];
  taskById: Map<number, EventTask>;
  editable: boolean;
  /** Whether the pinned task itself can be edited (looser than `editable`,
   * which gates the layout). */
  taskEditable: boolean;
  liveEvent: boolean;
  onChange: (patch: Partial<DesignerTile>) => void;
  onTaskUpdated?: (task: EventTask) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Pick-on-board mode for this tile's link target (2026-09). */
  picking: boolean;
  onPickOnBoard: () => void;
}) {
  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-2 py-1.5 text-sm outline-none";
  const pinned = tile.taskId != null ? taskById.get(tile.taskId) : undefined;
  const canLink = tile.tileKind !== "start" && tile.tileKind !== "finish";
  const isLadder = tile.jumpTo != null && tile.jumpTo > idx;
  return (
    <div className="border-osrs-bronze/30 bg-osrs-brown-dark/50 space-y-3 rounded border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">
          Tile {idx} <span className="text-osrs-parchment-dark/50 font-normal">of {count}</span>
        </h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={!editable}
            className="text-osrs-red/80 hover:text-osrs-red text-xs disabled:opacity-50"
          >
            Delete tile
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-xs"
          >
            Done
          </button>
        </div>
      </div>

      <div className="text-sm">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
          Difficulty — a random task of this tier is rolled each time a team lands here
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TASK_DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              disabled={!editable}
              onClick={() => onChange({ difficulty: d, taskId: null })}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                tile.difficulty === d && tile.taskId == null
                  ? "border-osrs-gold bg-osrs-brown-dark/70"
                  : "border-osrs-bronze/30 hover:border-osrs-gold/60"
              } disabled:opacity-50`}
            >
              <ItemDbIcon itemId={RUNE_ITEM_IDS[d]} size={14} />
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
          <button
            type="button"
            disabled={!editable}
            onClick={() => onChange({ difficulty: null, taskId: null })}
            className={`rounded border px-2 py-1 text-xs ${
              tile.difficulty == null && tile.taskId == null
                ? "border-osrs-gold bg-osrs-brown-dark/70"
                : "border-osrs-bronze/30 hover:border-osrs-gold/60"
            } disabled:opacity-50`}
          >
            Rest tile (no task)
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <span className="text-osrs-parchment-dark/70 block text-xs">
          …or pin one specific task (every landing gets exactly this task)
        </span>
        <EventTaskCombobox
          tasks={tasks}
          value={tile.taskId}
          disabled={!editable}
          onChange={(taskId) =>
            onChange(taskId != null ? { taskId, difficulty: null } : { taskId: null })
          }
          placeholder="Type to find a task — leave empty for “not pinned”"
          clearLabel="Unpin"
        />
        {tile.taskId != null && !taskById.has(tile.taskId) && (
          <span className="text-osrs-red block text-xs">
            Pinned task no longer exists — pick another or a difficulty.
          </span>
        )}
        {/* Points live on the task, not the tile: the API's tile payload has
            no points field (difficulty tiles score whatever task they roll),
            so the tile editor edits the pinned task itself. */}
        {pinned ? (
          <BoundTaskPanel
            groupId={groupId}
            eventId={eventId}
            task={pinned}
            editable={taskEditable}
            liveEvent={liveEvent}
            onTaskUpdated={onTaskUpdated}
          />
        ) : (
          tile.difficulty != null && (
            <p className="text-osrs-parchment-dark/50 text-xs">
              Points come from whichever {DIFFICULTY_LABELS[tile.difficulty].toLowerCase()} task
              this tile rolls — set them on the tasks themselves in the Tasks tab.
            </p>
          )
        )}
      </div>

      {canLink && (
        <div className="border-osrs-bronze/25 space-y-2 rounded border p-2 text-sm">
          <span className="text-osrs-parchment-dark/70 block text-xs">
            Chute or ladder — the tile a landing here sends the piece to (lower = chute, higher =
            ladder)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={count - 1}
              value={tile.jumpTo ?? ""}
              placeholder="tile #"
              disabled={!editable}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  onChange({ jumpTo: null, jumpWhen: "land" });
                  return;
                }
                const n = Number(raw);
                if (Number.isInteger(n) && n >= 0 && n < count && n !== idx) {
                  onChange({ jumpTo: n, ...(n < idx ? { jumpWhen: "land" as const } : {}) });
                }
              }}
              className={`${field} w-24`}
            />
            <button
              type="button"
              onClick={onPickOnBoard}
              disabled={!editable}
              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                picking
                  ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold"
                  : "border-osrs-bronze/40 hover:border-osrs-gold"
              }`}
            >
              {picking ? "Click a tile on the board…" : "Pick on board"}
            </button>
            <button
              type="button"
              onClick={() => onChange({ jumpTo: null, jumpWhen: "land" })}
              disabled={!editable || tile.jumpTo == null}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-2 py-1 text-xs disabled:opacity-50"
            >
              Clear
            </button>
            {tile.jumpTo != null && (
              <span className={`text-xs ${isLadder ? "text-emerald-300" : "text-red-300"}`}>
                {isLadder ? `🪜 Ladder to tile ${tile.jumpTo}` : `🕳️ Chute to tile ${tile.jumpTo}`}
              </span>
            )}
          </div>
          {isLadder && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Climb when</span>
              <select
                value={tile.jumpWhen}
                disabled={!editable}
                onChange={(e) => onChange({ jumpWhen: e.target.value as "land" | "complete" })}
                className={field}
              >
                <option value="land">A team lands here (classic)</option>
                <option value="complete">A team completes this tile&apos;s task (earn the climb)</option>
              </select>
              {tile.jumpWhen === "complete" && tile.taskId == null && tile.difficulty == null && (
                <span className="text-osrs-red block text-xs">
                  An earned ladder needs a task — give this tile a difficulty or pin a task.
                </span>
              )}
            </label>
          )}
          {tile.jumpTo != null &&
            tile.jumpWhen === "land" &&
            (tile.taskId != null || tile.difficulty) && (
              <span className="text-osrs-parchment-dark/50 block text-xs">
                A landing-triggered link moves the piece straight on, so this tile&apos;s own task
                is never drawn — the destination&apos;s is.
              </span>
            )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Label (optional)</span>
          <input
            value={tile.label}
            disabled={!editable}
            onChange={(e) => onChange({ label: e.target.value })}
            className={field}
            maxLength={255}
          />
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Tile kind</span>
          <select
            value={tile.tileKind}
            disabled={!editable}
            onChange={(e) => onChange({ tileKind: e.target.value as DesignerTile["tileKind"] })}
            className={field}
          >
            <option value="start">Start</option>
            <option value="normal">Normal</option>
            <option value="required">Required stop</option>
            <option value="finish">Finish</option>
          </select>
          {tile.tileKind === "required" && (
            <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
              A team whose roll would pass this tile stops on it and must complete its task
              before moving on. Cleared once per team.
            </span>
          )}
          {tile.tileKind === "finish" && (
            <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
              {tile.difficulty || tile.taskId != null
                ? "Reaching the finish assigns this task — completing it wins."
                : "Reaching the finish wins. Give it a difficulty or a pinned task to make teams complete one first."}
            </span>
          )}
        </label>
      </div>
    </div>
  );
}

/** The board style (settings.style): a preset the designer's tools and the
 * player copy key off. Saved immediately, like the other settings. */
function BoardStylePicker({
  value,
  busy,
  onChange,
}: {
  value: BoardStyle;
  busy: boolean;
  onChange: (style: BoardStyle) => void;
}) {
  return (
    <div className="border-osrs-bronze/20 flex flex-wrap items-center gap-3 rounded border p-3">
      <span className="text-osrs-gold text-sm font-semibold">Board style</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Board style">
        {BOARD_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={value === style}
            disabled={busy}
            onClick={() => onChange(style)}
            className={`rounded border px-3 py-1 text-sm disabled:opacity-50 ${
              value === style
                ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold font-semibold"
                : "border-osrs-bronze/40 hover:border-osrs-gold"
            }`}
          >
            {STYLE_LABELS[style]}
          </button>
        ))}
      </div>
      <span className="text-osrs-parchment-dark/60 text-xs">
        {value === "chutes_ladders"
          ? "A numbered grid with chutes and ladders. Generate the 10×10 grid, then place links — or add one to any tile by hand. For the classic feel, turn coins and the shop off in the settings below."
          : "The winding dice track: every tile draws a task, the first team to the finish wins."}
      </span>
    </div>
  );
}

/** Board settings (§2.5) — saved immediately per control (PATCH merge), NOT
 * part of the layout autosave: settings stay editable while the event runs. */
function BoardSettingsSection({
  groupId,
  event,
  settings,
  onSaved,
}: {
  groupId: number | null;
  event: EventDetail;
  settings: BoardSettings;
  onSaved: (s: BoardSettings) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (p: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveEventBoardSettings(groupId, event.id, p));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the settings."));
    } finally {
      setBusy(false);
    }
  };

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none";
  const m = settings.movement;
  const r = settings.tile_render;
  const c = settings.coins;
  // Per-event power-up tuning (web45a+): kept permissive on the read side —
  // the backend owns the defaults and deep-merges patches.
  const roadblock = (settings.items?.behaviors?.roadblock ?? {}) as {
    break_on?: "pass" | "land" | "both";
    stall_turns?: number;
  };

  return (
    <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3" disabled={busy}>
      <legend className="text-osrs-gold px-1 text-sm font-semibold">Board settings</legend>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Movement</span>
          <select
            value={m.mode}
            onChange={(e) => patch({ movement: { mode: e.target.value } })}
            className={`${field} w-full`}
          >
            <option value="dice">Dice roll</option>
            <option value="fixed_step">Fixed step</option>
          </select>
        </label>
        {m.mode === "dice" ? (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Dice</span>
            <span className="flex items-center gap-1.5">
              <QuantityInput
                min={1}
                max={8}
                value={m.dice_count}
                commitOn="blur"
                onChange={(dice_count) => patch({ movement: { dice_count } })}
                className={`${field} w-16`}
              />
              <span className="text-osrs-parchment-dark/60 text-xs">d</span>
              <QuantityInput
                min={1}
                max={100}
                value={m.dice_sides}
                commitOn="blur"
                onChange={(dice_sides) => patch({ movement: { dice_sides } })}
                className={`${field} w-16`}
              />
            </span>
            <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
              1-sided dice have no randomness, so they save as a fixed step of the same size.
            </span>
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Tiles per turn</span>
            <QuantityInput
              min={1}
              max={20}
              value={m.fixed_step}
              commitOn="blur"
              onChange={(fixed_step) => patch({ movement: { fixed_step } })}
              className={`${field} w-20`}
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Roll trigger</span>
          <select
            value={m.trigger}
            onChange={(e) => patch({ movement: { trigger: e.target.value } })}
            className={`${field} w-full`}
          >
            <option value="manual">Manual — someone presses Roll</option>
            <option value="auto">Automatic on completion</option>
          </select>
        </label>
        {m.trigger === "manual" && (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Who may roll</span>
            <select
              value={m.manual_roller}
              onChange={(e) => patch({ movement: { manual_roller: e.target.value } })}
              className={`${field} w-full`}
            >
              <option value="team">Team members</option>
              <option value="group_admin">Group admins only</option>
              <option value="either">Either</option>
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Exact finish</span>
          <select
            value={settings.win.exact_finish ?? "off"}
            onChange={(e) => patch({ win: { exact_finish: e.target.value } })}
            className={`${field} w-full`}
          >
            <option value="off">Off — an overshoot lands on the finish</option>
            <option value="stay">Stay — an overshoot loses the move (roll again)</option>
            <option value="bounce">Bounce — an overshoot bounces back from the finish</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Tile rendering</span>
          <select
            value={r.mode}
            onChange={(e) => patch({ tile_render: { mode: e.target.value } })}
            className={`${field} w-full`}
          >
            <option value="rune">Rune icons (by difficulty)</option>
            <option value="invisible">Invisible (my image shows the tiles)</option>
            <option value="outline">Outline hotspots</option>
          </select>
        </label>
        {r.mode === "outline" && (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Outline</span>
            <span className="flex items-center gap-1.5">
              <QuantityInput
                min={1}
                max={12}
                value={r.outline_width}
                commitOn="blur"
                onChange={(outline_width) => patch({ tile_render: { outline_width } })}
                className={`${field} w-16`}
              />
              <input
                type="color"
                defaultValue={r.outline_color}
                onBlur={(e) => {
                  if (e.target.value !== r.outline_color)
                    patch({ tile_render: { outline_color: e.target.value } });
                }}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
            </span>
          </label>
        )}
        {r.mode === "rune" && (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Rune icon size ({r.icon_size ?? 20}px)
            </span>
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={8}
                max={64}
                defaultValue={r.icon_size ?? 20}
                key={r.icon_size ?? 20}
                onPointerUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  if (v >= 8 && v <= 64 && v !== (r.icon_size ?? 20))
                    patch({ tile_render: { ...r, icon_size: v } });
                }}
                onKeyUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  if (v >= 8 && v <= 64 && v !== (r.icon_size ?? 20))
                    patch({ tile_render: { ...r, icon_size: v } });
                }}
                className="flex-1"
              />
              <QuantityInput
                min={8}
                max={64}
                value={r.icon_size ?? 20}
                commitOn="blur"
                onChange={(icon_size) => patch({ tile_render: { ...r, icon_size } })}
                className={`${field} w-16`}
              />
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.enabled}
            onChange={(e) => patch({ coins: { enabled: e.target.checked } })}
          />
          Coins enabled
        </label>
        {c.enabled && (
          <div className="text-sm lg:col-span-2">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Coins per completed task (by tile difficulty)
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {EVENT_TASK_DIFFICULTIES.map((d) => (
                <span key={d} className="flex items-center gap-1">
                  <ItemDbIcon itemId={RUNE_ITEM_IDS[d]} size={14} />
                  <QuantityInput
                    min={0}
                    value={c.per_difficulty[d] ?? c.default}
                    commitOn="blur"
                    onChange={(v) => patch({ coins: { per_difficulty: { [d]: v } } })}
                    className={`${field} w-20`}
                  />
                </span>
              ))}
            </span>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.mercy.enabled}
            onChange={(e) => patch({ mercy: { enabled: e.target.checked } })}
          />
          Mercy rule (auto-complete stuck tasks)
        </label>
        {settings.mercy.enabled && (
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Hours before mercy
            </span>
            <QuantityInput
              min={1}
              max={336}
              value={settings.mercy.base_hours}
              commitOn="blur"
              onChange={(base_hours) => patch({ mercy: { base_hours } })}
              className={`${field} w-20`}
            />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.shop.enabled}
            onChange={(e) => patch({ shop: { enabled: e.target.checked } })}
          />
          Shop enabled{" "}
          <span className="text-osrs-parchment-dark/50 text-xs">
            (coins, power-ups &amp; PvP — configure items under Shop)
          </span>
        </label>
      </div>

      {settings.shop.enabled && (
        <div className="border-osrs-bronze/20 space-y-2 rounded border p-3">
          <h4 className="text-osrs-gold text-xs font-semibold">Power-up behavior</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Dinh&apos;s Bulwark (roadblock) — when does it break?
              </span>
              <select
                value={roadblock.break_on ?? "pass"}
                onChange={(e) =>
                  patch({ items: { behaviors: { roadblock: { break_on: e.target.value } } } })
                }
                className={`${field} w-full`}
              >
                <option value="pass">Breaks when a team is stopped passing through it</option>
                <option value="land">Breaks only when a team lands exactly on it</option>
                <option value="both">Breaks on either</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Turns the blocked team loses
              </span>
              <QuantityInput
                min={0}
                max={3}
                value={roadblock.stall_turns ?? 1}
                commitOn="blur"
                onChange={(stall_turns) =>
                  patch({ items: { behaviors: { roadblock: { stall_turns } } } })
                }
                className={`${field} w-20`}
              />
            </label>
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** Per-team game-piece picker: an OSRS item id rendered as the piece. */
function GamePiecesSection({
  groupId,
  event,
}: {
  groupId: number | null;
  event: EventDetail;
}) {
  const [error, setError] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState<number | null>(null);
  const [pieces, setPieces] = useState<Record<number, number | null>>(() =>
    Object.fromEntries((event.teams ?? []).map((t) => [t.id, t.piece_item_id ?? null])),
  );

  const setPiece = async (teamId: number, itemIdRaw: string) => {
    const itemId = itemIdRaw.trim() ? Number(itemIdRaw.trim()) : null;
    if (itemId != null && (!Number.isInteger(itemId) || itemId <= 0)) {
      setError("Piece must be a positive OSRS item id.");
      return;
    }
    setSavingTeam(teamId);
    setError(null);
    try {
      await updateEventTeam(groupId, event.id, teamId, { piece_item_id: itemId });
      setPieces((prev) => ({ ...prev, [teamId]: itemId }));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the piece."));
    } finally {
      setSavingTeam(null);
    }
  };

  const teams = event.teams ?? [];
  if (teams.length === 0) return null;

  return (
    <fieldset className="border-osrs-bronze/20 space-y-2 rounded border p-3">
      <legend className="text-osrs-gold px-1 text-sm font-semibold">Game pieces</legend>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Each team&apos;s piece is an OSRS item icon (enter an item id — e.g. 13652 for a dragon
        claw). Leave empty for the team&apos;s color dot.
      </p>
      {error && <Alert variant="error">{error}</Alert>}
      <ul className="space-y-1.5">
        {teams.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: t.color ?? "#c8a25a" }}
            />
            <span className="w-40 truncate">{t.name}</span>
            <ItemDbIcon itemId={pieces[t.id]} size={22} />
            <input
              type="number"
              min={1}
              placeholder="item id"
              defaultValue={pieces[t.id] ?? ""}
              onBlur={(e) => {
                const next = e.target.value.trim() ? Number(e.target.value.trim()) : null;
                if (next !== (pieces[t.id] ?? null)) setPiece(t.id, e.target.value);
              }}
              disabled={savingTeam === t.id}
              className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-28 rounded border px-2 py-1 text-sm outline-none"
            />
            {savingTeam === t.id && (
              <span className="text-osrs-parchment-dark/50 text-xs">Saving…</span>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
