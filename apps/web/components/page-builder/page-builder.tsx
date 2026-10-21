"use client";

/**
 * The page builder (web137a): one editor for a group's public page, the
 * default profile a group gives its members, and a player's own profile.
 *
 * Full-screen, three panes:
 *   left   Blocks (the page's blocks, drag to reorder) | Add | Templates
 *   centre the REAL page in an iframe, server-rendered from the saved draft,
 *          at desktop / tablet / phone width; click a block to edit it
 *   right  settings for the selected block, or the page style
 *
 * Every change autosaves the draft (debounced) and the preview re-renders.
 * Publishing is the separate, deliberate step, and the paid one: saving and
 * previewing are free so anyone can try it. On narrow screens the panes
 * become tabs above the preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LayoutBuilderState, LayoutScope, PageBlockType, PageLayout, PageTheme } from "@droptracker/api-types";
import {
  BLOCK_CATEGORIES,
  BLOCK_DEF,
  defaultLayout,
  defsForScope,
  layoutKind,
  makeBlock,
  newBlockId,
  templatesFor,
} from "@/lib/page-layout/catalog";
import {
  discardLayoutDraftAction,
  publishLayoutAction,
  saveLayoutDraftAction,
  unpublishLayoutAction,
  type BuilderResult,
} from "@/app/(site)/page-builder-actions";
import { BlockInspector, PageInspector, Segmented, type Block } from "./inspector";

const MAX_BLOCKS = 40;
const SAVE_DEBOUNCE_MS = 700;
const DEVICES = {
  desktop: { width: 1280, label: "Desktop" },
  tablet: { width: 820, label: "Tablet" },
  phone: { width: 390, label: "Phone" },
} as const;
type Device = keyof typeof DEVICES;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Pane = "blocks" | "add" | "templates" | "settings";

export type PageBuilderProps = {
  scope: LayoutScope;
  subjectId: number;
  initial: LayoutBuilderState;
  /** Shown in the top bar, e.g. "Pegasus PvM". */
  title: string;
  /** Same-origin URL of the draft preview page. */
  previewUrl: string;
  /** The live public page. */
  liveUrl: string;
  /** Where "Done" goes. */
  exitUrl: string;
  /** Where the upgrade prompt links. */
  upgradeUrl: string;
  /** Scope tabs, e.g. "Group page" / "Member profiles". */
  tabs?: { label: string; href: string; active: boolean }[];
  /** Group id for the PB boss picker (group pages only). */
  groupId?: number;
};

function cloneLayout(layout: PageLayout): PageLayout {
  return structuredClone(layout);
}

/* --- left pane: block list ------------------------------------------------------ */

function LayerRow({
  block,
  index,
  total,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const def = BLOCK_DEF[block.type];
  const width = block.width as string;
  const hide = block.hide_on as string;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/layer flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
        selected ? "border-osrs-gold bg-osrs-gold/10" : "border-osrs-bronze/25 hover:border-osrs-bronze/60"
      } ${isDragging ? "relative z-10 opacity-70 shadow-lg" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright cursor-grab touch-none px-0.5"
        aria-label={`Drag ${def?.label ?? block.type}`}
      >
        ⠿
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="w-5 shrink-0 text-center">{def?.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{(block.title as string) || def?.label || block.type}</span>
          {(block.title as string) && (
            <span className="text-osrs-parchment-dark/50 block truncate text-[11px]">{def?.label}</span>
          )}
        </span>
        {width !== "full" && (
          <span className="text-osrs-parchment-dark/60 shrink-0 text-[10px]">
            {{ two_thirds: "⅔", half: "½", third: "⅓" }[width]}
          </span>
        )}
        {hide !== "none" && (
          <span className="text-osrs-parchment-dark/60 shrink-0 text-[10px]" title={hide === "mobile" ? "Desktop only" : "Phone only"}>
            {hide === "mobile" ? "🖥" : "📱"}
          </span>
        )}
      </button>
      <span className="hidden shrink-0 gap-0.5 group-hover/layer:flex">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="hover:text-osrs-gold-bright px-0.5 disabled:opacity-30" aria-label="Move up">
          ↑
        </button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="hover:text-osrs-gold-bright px-0.5 disabled:opacity-30" aria-label="Move down">
          ↓
        </button>
        <button type="button" onClick={onDuplicate} className="hover:text-osrs-gold-bright px-0.5" aria-label="Duplicate" title="Duplicate">
          ⧉
        </button>
        <button type="button" onClick={onDelete} className="hover:text-osrs-red px-0.5" aria-label="Delete" title="Delete">
          ✕
        </button>
      </span>
    </li>
  );
}

/* --- builder ------------------------------------------------------------------------- */

export function PageBuilder(props: PageBuilderProps) {
  const { scope, subjectId, initial } = props;
  const kind = layoutKind(scope);
  const [state, setState] = useState<LayoutBuilderState>(initial);
  const [layout, setLayout] = useState<PageLayout>(() => cloneLayout(initial.draft ?? defaultLayout(scope)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [pane, setPane] = useState<Pane>("blocks");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  // Undo/redo: snapshots of the layout. Rapid edits to the same block (typing)
  // coalesce into one step.
  const history = useRef<{ stack: PageLayout[]; index: number; lastKey: string; lastAt: number }>({
    stack: [cloneLayout(layout)],
    index: 0,
    lastKey: "",
    lastAt: 0,
  });
  const [, forceHistory] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 1000, h: 700 });
  const dirty = useRef(false);
  const saveSeq = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  const selected = useMemo(
    () => (layout.blocks.find((b) => b.id === selectedId) as Block | undefined) ?? null,
    [layout.blocks, selectedId],
  );

  /* --- preview frame messaging ----------------------------------------------------- */

  const postToFrame = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; id?: string | null };
      if (data?.type === "dt-pl-click") {
        setSelectedId(data.id ?? null);
        if (data.id) setPane("settings");
      }
      if (data?.type === "dt-pl-ready") postToFrame({ type: "dt-pl-select", id: selectedIdRef.current });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToFrame]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    postToFrame({ type: "dt-pl-select", id: selectedId });
  }, [selectedId, postToFrame]);

  /* --- stage sizing ---------------------------------------------------------------------- */

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const deviceWidth = DEVICES[device].width;
  const scale = Math.min(1, (stage.w - 24) / deviceWidth);
  const frameHeight = Math.max(400, (stage.h - 24) / scale);

  /* --- editing ----------------------------------------------------------------------------- */

  const commit = useCallback((next: PageLayout, coalesceKey = "") => {
    const h = history.current;
    const now = Date.now();
    const snapshot = cloneLayout(next);
    if (coalesceKey && coalesceKey === h.lastKey && now - h.lastAt < 1200) {
      h.stack[h.index] = snapshot;
    } else {
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(snapshot);
      if (h.stack.length > 100) h.stack.shift();
      h.index = h.stack.length - 1;
    }
    h.lastKey = coalesceKey;
    h.lastAt = now;
    dirty.current = true;
    setLayout(next);
    forceHistory((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    const h = history.current;
    if (h.index === 0) return;
    h.index -= 1;
    h.lastKey = "";
    dirty.current = true;
    setLayout(cloneLayout(h.stack[h.index]!));
    forceHistory((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const h = history.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    h.lastKey = "";
    dirty.current = true;
    setLayout(cloneLayout(h.stack[h.index]!));
    forceHistory((n) => n + 1);
  }, []);

  const updateBlock = (id: string, patch: Record<string, unknown>) => {
    commit(
      { ...layout, blocks: layout.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) },
      `block:${id}:${Object.keys(patch).join(",")}`,
    );
  };

  const updateTheme = (patch: Partial<PageTheme>) => {
    commit({ ...layout, theme: { ...layout.theme, ...patch } }, `theme:${Object.keys(patch).join(",")}`);
  };

  const removeBlock = (id: string) => {
    commit({ ...layout, blocks: layout.blocks.filter((b) => b.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const i = layout.blocks.findIndex((b) => b.id === id);
    if (i < 0 || layout.blocks.length >= MAX_BLOCKS) return;
    const copy = { ...structuredClone(layout.blocks[i]!), id: newBlockId() };
    const blocks = [...layout.blocks];
    blocks.splice(i + 1, 0, copy);
    commit({ ...layout, blocks });
    setSelectedId(copy.id as string);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const i = layout.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.blocks.length) return;
    commit({ ...layout, blocks: arrayMove(layout.blocks, i, j) });
  };

  const addBlock = (type: PageBlockType) => {
    if (layout.blocks.length >= MAX_BLOCKS) {
      setError(`A page can hold at most ${MAX_BLOCKS} blocks.`);
      return;
    }
    const block = makeBlock(type);
    const at = selectedId ? layout.blocks.findIndex((b) => b.id === selectedId) + 1 : layout.blocks.length;
    const blocks = [...layout.blocks];
    blocks.splice(at <= 0 ? blocks.length : at, 0, block);
    commit({ ...layout, blocks });
    setSelectedId(block.id as string);
    setPane("settings");
  };

  const applyTemplate = (build: () => PageLayout, label: string) => {
    if (!window.confirm(`Replace the current design with “${label}”? You can undo this.`)) return;
    commit(cloneLayout(build()));
    setSelectedId(null);
    setPane("blocks");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = layout.blocks.findIndex((b) => b.id === active.id);
    const to = layout.blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    commit({ ...layout, blocks: arrayMove(layout.blocks, from, to) });
  };

  /* --- autosave ----------------------------------------------------------------------------- */

  useEffect(() => {
    if (!dirty.current) return;
    const mine = ++saveSeq.current;
    setStatus("saving");
    const t = setTimeout(async () => {
      const res = await saveLayoutDraftAction(scope, subjectId, layout);
      if (mine !== saveSeq.current) return; // a newer save is in flight
      if (res.ok) {
        dirty.current = false;
        setState(res.state);
        setStatus("saved");
        setError(null);
        postToFrame({ type: "dt-pl-reload" });
      } else {
        setStatus("error");
        setError(res.error);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [layout, scope, subjectId, postToFrame]);

  // Warn before leaving with an unsaved edit.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* --- keyboard ------------------------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
      } else if (!typing && selectedId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        removeBlock(selectedId);
      } else if (e.key === "Escape" && !typing) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* --- publish ----------------------------------------------------------------------------------- */

  const run = async (fn: () => Promise<BuilderResult>, okNotice: ReactNode) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      setNotice(okNotice);
      return res.state;
    }
    if (res.code === "entitlement_required") {
      setNotice(<UpgradeNotice kind={kind} url={props.upgradeUrl} />);
    } else {
      setError(res.error);
    }
    return null;
  };

  const publish = async () => {
    if (!state.can_publish) {
      setNotice(<UpgradeNotice kind={kind} url={props.upgradeUrl} />);
      return;
    }
    if (dirty.current || status === "saving") {
      setError("Still saving your last change. Try again in a moment.");
      return;
    }
    await run(
      () => publishLayoutAction(scope, subjectId),
      <span>
        Published. <a className="underline" href={props.liveUrl} target="_blank" rel="noreferrer">See it live</a>
      </span>,
    );
  };

  const unpublish = () =>
    window.confirm(
      kind === "group" && scope === "group"
        ? "Switch back to the standard group page? Your design stays saved here."
        : "Switch back to the standard layout? Your design stays saved here.",
    ) && run(() => unpublishLayoutAction(scope, subjectId), "Back to the standard layout. Your design is still saved.");

  const discard = async () => {
    if (!window.confirm(state.published ? "Throw away your unpublished changes?" : "Start over from the standard layout?")) return;
    const next = await run(() => discardLayoutDraftAction(scope, subjectId), "Changes discarded.");
    if (next) {
      const fresh = cloneLayout(next.draft ?? defaultLayout(scope));
      history.current = { stack: [cloneLayout(fresh)], index: 0, lastKey: "", lastAt: 0 };
      dirty.current = false;
      setLayout(fresh);
      setSelectedId(null);
      postToFrame({ type: "dt-pl-reload" });
    }
  };

  /* --- render ------------------------------------------------------------------------------------- */

  const defs = defsForScope(scope);
  const present = new Set(layout.blocks.map((b) => b.type as string));
  const h = history.current;
  const isLive = state.published != null;
  const pending = state.has_unpublished_changes || !isLive;

  const statusText =
    status === "saving" ? "Saving…" : status === "error" ? "Not saved" : status === "saved" ? "Draft saved" : "Draft";

  const leftPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-osrs-bronze/25 flex gap-1 border-b p-2">
        {(
          [
            ["blocks", `Blocks (${layout.blocks.length})`],
            ["add", "+ Add"],
            ["templates", "Templates"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold ${
              pane === k || (k === "blocks" && pane === "settings") ? "bg-osrs-bronze/40 text-osrs-gold-bright" : "hover:bg-osrs-bronze/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {(pane === "blocks" || pane === "settings") && (
          <>
            <div className="text-osrs-parchment-dark/55 mb-2 text-xs">
              The header (icon and name) always comes first. Drag blocks to reorder them.
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={layout.blocks.map((b) => b.id as string)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {layout.blocks.map((b, i) => (
                    <LayerRow
                      key={b.id as string}
                      block={b as Block}
                      index={i}
                      total={layout.blocks.length}
                      selected={b.id === selectedId}
                      onSelect={() => {
                        setSelectedId(b.id as string);
                        setPane("settings");
                      }}
                      onMove={(dir) => moveBlock(b.id as string, dir)}
                      onDuplicate={() => duplicateBlock(b.id as string)}
                      onDelete={() => removeBlock(b.id as string)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {layout.blocks.length === 0 && (
              <p className="text-osrs-parchment-dark/60 py-6 text-center text-sm">
                Empty page. Add a block or pick a template.
              </p>
            )}
            <button
              type="button"
              onClick={() => setPane("add")}
              className="border-osrs-bronze/50 hover:border-osrs-gold mt-3 w-full rounded-md border border-dashed py-2 text-sm"
            >
              + Add a block
            </button>
          </>
        )}
        {pane === "add" && (
          <div className="space-y-4">
            <p className="text-osrs-parchment-dark/55 text-xs">
              {selected ? "New blocks go below the selected one." : "New blocks go at the end."}
            </p>
            {BLOCK_CATEGORIES.map((cat) => {
              const items = defs.filter((d) => d.category === cat.key);
              if (items.length === 0) return null;
              return (
                <div key={cat.key}>
                  <h4 className="text-osrs-parchment-dark/60 mb-1.5 text-[11px] font-semibold tracking-wider uppercase">{cat.label}</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((d) => {
                      const taken = d.single && present.has(d.type);
                      return (
                        <button
                          key={d.type}
                          type="button"
                          disabled={taken}
                          title={taken ? "Already on the page" : d.description}
                          onClick={() => addBlock(d.type)}
                          className="border-osrs-bronze/35 hover:border-osrs-gold hover:bg-osrs-bronze/15 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="block text-base leading-none">{d.icon}</span>
                          <span className="mt-1 block text-xs font-semibold">{d.label}</span>
                          <span className="text-osrs-parchment-dark/55 mt-0.5 block text-[11px] leading-snug">{d.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pane === "templates" && (
          <div className="space-y-2">
            <p className="text-osrs-parchment-dark/55 text-xs">A starting point. Change anything afterwards.</p>
            {templatesFor(scope).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTemplate(t.build, t.label)}
                className="border-osrs-bronze/35 hover:border-osrs-gold hover:bg-osrs-bronze/15 block w-full rounded-md border p-3 text-left"
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="text-osrs-parchment-dark/60 block text-xs">{t.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightPane = (
    <div className="h-full min-h-0 overflow-y-auto">
      {selected ? (
        <BlockInspector
          key={selected.id}
          block={selected}
          groupId={props.groupId}
          onChange={(patch) => updateBlock(selected.id, patch)}
          onDuplicate={() => duplicateBlock(selected.id)}
          onDelete={() => removeBlock(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <PageInspector theme={layout.theme} kind={kind} onChange={updateTheme} />
      )}
    </div>
  );

  return (
    <div className="bg-osrs-surface-0 fixed inset-0 z-[60] flex flex-col">
      {/* Top bar */}
      <header className="border-osrs-bronze/30 bg-osrs-surface-1 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <Link href={props.exitUrl as Route} className="text-osrs-parchment-dark/80 hover:text-osrs-gold-bright text-sm">
          ← Done
        </Link>
        <div className="min-w-0">
          <div className="text-osrs-gold-bright truncate text-sm font-semibold">{props.title}</div>
          <div className="text-osrs-parchment-dark/60 flex items-center gap-1.5 text-[11px]">
            <span
              className={`size-1.5 rounded-full ${
                status === "error" ? "bg-osrs-red" : status === "saving" ? "bg-osrs-gold animate-pulse" : "bg-osrs-green"
              }`}
            />
            {statusText}
            <span aria-hidden>·</span>
            {isLive ? (pending ? "Live, with unpublished changes" : "Live") : "Not published"}
          </div>
        </div>
        {props.tabs && (
          <nav className="flex gap-1">
            {props.tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href as Route}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  t.active ? "bg-osrs-bronze/45 text-osrs-gold-bright" : "text-osrs-parchment-dark/80 hover:bg-osrs-bronze/20"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-52">
            <Segmented
              value={device}
              options={(Object.keys(DEVICES) as Device[]).map((d) => ({ value: d, label: DEVICES[d].label }))}
              onChange={setDevice}
            />
          </div>
          <button type="button" onClick={undo} disabled={h.index === 0} className="hover:text-osrs-gold-bright px-1.5 disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo">
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={h.index >= h.stack.length - 1}
            className="hover:text-osrs-gold-bright px-1.5 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
          <button type="button" onClick={discard} disabled={busy} className="text-osrs-parchment-dark/80 hover:text-osrs-gold-bright text-xs">
            {state.published ? "Discard changes" : "Start over"}
          </button>
          {isLive && (
            <button type="button" onClick={unpublish} disabled={busy} className="text-osrs-parchment-dark/80 hover:text-osrs-gold-bright text-xs">
              Use standard layout
            </button>
          )}
          <a href={props.liveUrl} target="_blank" rel="noreferrer" className="text-osrs-parchment-dark/80 hover:text-osrs-gold-bright text-xs">
            View live ↗
          </a>
          <button
            type="button"
            onClick={publish}
            disabled={busy || (isLive && !pending)}
            className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Working…" : isLive && !pending ? "Published" : state.can_publish ? "Publish" : "Publish ★"}
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div
          className={`flex items-start gap-3 px-4 py-2 text-sm ${
            error ? "bg-osrs-red/15 text-osrs-red" : "bg-osrs-gold/10 text-osrs-parchment"
          }`}
          role={error ? "alert" : "status"}
        >
          <div className="flex-1">{error ?? notice}</div>
          <button type="button" onClick={() => (error ? setError(null) : setNotice(null))} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Narrow screens: pick a pane, preview below. */}
      <div className="border-osrs-bronze/25 flex gap-1 border-b p-2 lg:hidden">
        {(
          [
            ["blocks", "Blocks"],
            ["add", "Add"],
            ["templates", "Templates"],
            ["settings", selected ? "Edit block" : "Page style"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPane(k)}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold ${
              pane === k ? "bg-osrs-bronze/40 text-osrs-gold-bright" : "hover:bg-osrs-bronze/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <aside
          className={`border-osrs-bronze/25 bg-osrs-surface-1 min-h-0 border-r max-lg:max-h-[45vh] ${
            pane === "settings" ? "max-lg:hidden" : ""
          }`}
        >
          {leftPane}
        </aside>
        <main ref={stageRef} className="bg-osrs-surface-0 relative min-h-[50vh] flex-1 overflow-hidden lg:min-h-0">
          <div
            className="absolute top-3 left-1/2 origin-top overflow-hidden rounded-lg border border-black/40 shadow-2xl"
            style={{ width: deviceWidth, height: frameHeight, transform: `translateX(-50%) scale(${scale})` }}
          >
            <iframe ref={iframeRef} src={props.previewUrl} title="Page preview" className="size-full bg-[var(--dt-surface-0)]" />
          </div>
        </main>
        <aside
          className={`border-osrs-bronze/25 bg-osrs-surface-1 min-h-0 border-l max-lg:max-h-[45vh] ${
            pane === "settings" ? "" : "max-lg:hidden"
          }`}
        >
          {rightPane}
        </aside>
      </div>
    </div>
  );
}

function UpgradeNotice({ kind, url }: { kind: "group" | "player"; url: string }) {
  return (
    <span>
      {kind === "group"
        ? "Publishing a custom design is a Supporter perk for groups. Your draft is saved and you can keep editing and previewing."
        : "Publishing a custom profile is a Supporter perk. Your draft is saved and you can keep editing and previewing."}{" "}
      <a href={url} className="text-osrs-gold-bright underline">
        See plans
      </a>
    </span>
  );
}
