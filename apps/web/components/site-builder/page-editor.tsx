"use client";

/**
 * Drag-and-drop page editor for group mini-sites (sites-v1).
 *
 * Layout: the left ~2/3 is the CANVAS — a live preview of the page inside the
 * site's own palette, with a mock tenant header/footer so admins see the page
 * as visitors will. The right panel is the BUILDER: a palette of draggable
 * block types (drag onto the canvas, or click to append) and, when a canvas
 * block is selected, that block's settings inspector.
 *
 * Interactions: drag palette→canvas inserts at the drop position; dragging a
 * canvas block reorders it; dropping a canvas block on the trash zone (or its
 * ✕) removes it. Saving stays explicit (draft → publish), with an
 * unsaved-changes guard on navigation.
 */
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GroupProfile, SiteAdmin, SiteMeta } from "@droptracker/api-types";
import { sitePaletteStyle } from "@/lib/site-themes";
import { Button } from "@/components/ui";
import { BLOCK_CATALOG, BLOCK_META, BlockForm, newBlockId, type Block } from "./block-forms";
import { BlockPreview } from "./block-previews";

const TRASH_ID = "__trash__";
const CANVAS_ID = "__canvas__";

function PaletteItem({ type }: { type: string }) {
  const meta = BLOCK_META[type]!;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", blockType: type },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`border-osrs-bronze/40 hover:border-osrs-gold/60 hover:bg-osrs-bronze/20 cursor-grab rounded-lg border p-2 transition-colors ${
        isDragging ? "opacity-40" : ""
      }`}
      title={meta.description}
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{meta.icon}</span>
        <span className="text-xs font-medium">{meta.label}</span>
      </div>
    </div>
  );
}

function SortableCanvasBlock({
  block,
  group,
  selected,
  onSelect,
  onRemove,
}: {
  block: Block;
  group: GroupProfile;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const id = block.id as string;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { source: "canvas" },
  });
  const meta = BLOCK_META[block.type as string];
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/block relative rounded-lg ${isDragging ? "z-10 opacity-60" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Selection / affordance chrome sits OVER the live preview. */}
      <div
        className={`pointer-events-none absolute -inset-1.5 rounded-xl border-2 transition-colors ${
          selected
            ? "border-osrs-gold/80"
            : "border-transparent group-hover/block:border-osrs-bronze/50"
        }`}
      />
      <div className="absolute -top-3 right-2 z-10 hidden items-center gap-1 group-hover/block:flex">
        <span
          {...listeners}
          {...attributes}
          className="bg-osrs-surface-3 border-osrs-bronze/50 cursor-grab rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase"
        >
          ⠿ {meta?.label ?? (block.type as string)}
        </span>
        <button
          type="button"
          className="bg-osrs-surface-3 border-osrs-bronze/50 text-osrs-red rounded border px-1.5 py-0.5 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </button>
      </div>
      <BlockPreview block={block} group={group} />
    </div>
  );
}

function TrashZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 text-center text-sm font-medium transition-colors ${
        isOver ? "border-osrs-red bg-osrs-red/20 text-osrs-red" : "border-osrs-red/40 text-osrs-red/70"
      }`}
    >
      🗑 Drop here to remove
    </div>
  );
}

function CanvasDropArea({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-40 space-y-6 rounded-lg p-1 ${
        empty
          ? `border-2 border-dashed ${isOver ? "border-osrs-gold/70" : "border-osrs-bronze/40"} flex items-center justify-center py-16`
          : ""
      }`}
    >
      {empty ? (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Drag blocks here from the panel on the right →
        </p>
      ) : (
        children
      )}
    </div>
  );
}

export function PageEditor({
  site,
  meta,
  group,
  pageTitle,
  pagePublished,
  hasUnpublishedChanges,
  initialBlocks,
  initialPageCss,
  saving,
  saveError,
  onSave,
  onPublish,
  onClose,
  onDirtyChange,
}: {
  site: SiteAdmin;
  meta: SiteMeta;
  group: GroupProfile;
  pageTitle: string;
  pagePublished: boolean;
  /** Saved draft differs from the published copy (server-computed). */
  hasUnpublishedChanges: boolean;
  initialBlocks: Block[];
  initialPageCss: string;
  saving: boolean;
  /** Last save/publish failure, surfaced in the toolbar — the shell's alert
   *  sits above the editor and is easy to miss when scrolled into the canvas. */
  saveError?: string | null;
  onSave: (blocks: Block[], pageCss: string) => void;
  /** Publish the SAVED draft (the shell saves first when dirty). */
  onPublish: (blocks: Block[], pageCss: string, dirty: boolean) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [pageCss, setPageCss] = useState(initialPageCss);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState<{ label: string; fromCanvas: boolean } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => blocks.map((b) => b.id as string), [blocks]);
  const selected = blocks.find((b) => (b.id as string) === selectedId) ?? null;

  useEffect(() => {
    setBlocks(initialBlocks);
    setPageCss(initialPageCss);
    setSelectedId(null);
    setDirty(false);
  }, [initialBlocks, initialPageCss]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, onDirtyChange]);

  function mutate(next: Block[]) {
    setBlocks(next);
    setDirty(true);
  }

  function insertFromPalette(type: string, atIndex: number | null) {
    if (blocks.length >= meta.limits.max_blocks_per_page) return;
    if (type === "custom_html" && htmlCount >= htmlMax) return;
    const def = BLOCK_CATALOG.find((b) => b.type === type);
    if (!def) return;
    const block = { ...def.make(), id: newBlockId() };
    const next = [...blocks];
    next.splice(atIndex ?? blocks.length, 0, block);
    mutate(next);
    setSelectedId(block.id as string);
  }

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { source?: string; blockType?: string } | undefined;
    if (data?.source === "palette") {
      setDragging({ label: BLOCK_META[data.blockType!]?.label ?? "Block", fromCanvas: false });
    } else {
      const b = blocks.find((x) => (x.id as string) === e.active.id);
      setDragging({
        label: BLOCK_META[(b?.type as string) ?? ""]?.label ?? "Block",
        fromCanvas: true,
      });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const data = e.active.data.current as { source?: string; blockType?: string } | undefined;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;

    if (data?.source === "palette") {
      if (overId === TRASH_ID) return;
      const overIndex = ids.indexOf(overId);
      insertFromPalette(data.blockType!, overIndex === -1 ? null : overIndex);
      return;
    }

    // Canvas block: trash or reorder.
    const activeId = e.active.id as string;
    if (overId === TRASH_ID) {
      mutate(blocks.filter((b) => (b.id as string) !== activeId));
      if (selectedId === activeId) setSelectedId(null);
      return;
    }
    if (overId !== activeId) {
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from !== -1 && to !== -1) mutate(arrayMove(blocks, from, to));
    }
  }

  const paletteVars = sitePaletteStyle(site.theme_key, site.palette);
  const canAdd = blocks.length < meta.limits.max_blocks_per_page;
  const htmlCount = blocks.filter((b) => b.type === "custom_html").length;
  const htmlMax = meta.limits.max_custom_html_blocks_per_page;
  const canAddType = (type: string) =>
    canAdd && (type !== "custom_html" || htmlCount < htmlMax);

  return (
    <div className="border-osrs-bronze/30 bg-osrs-surface-1 shadow-osrs-card rounded-xl border">
      {/* Toolbar */}
      <div className="border-osrs-bronze/30 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="text-sm">
          <span className="text-osrs-gold font-semibold">Editing: {pageTitle}</span>
          {dirty ? (
            <span className="text-osrs-ember ml-2 text-xs">unsaved changes</span>
          ) : hasUnpublishedChanges && pagePublished ? (
            <span className="text-osrs-ember ml-2 text-xs">
              saved draft not published yet
            </span>
          ) : !pagePublished ? (
            <span className="text-osrs-parchment-dark/60 ml-2 text-xs">page is a draft</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving || !dirty}
            onClick={() => {
              onSave(blocks, pageCss);
              setDirty(false);
            }}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || (!dirty && !hasUnpublishedChanges && pagePublished)}
            title="Saves your draft (if needed) and puts it live"
            onClick={() => {
              onPublish(blocks, pageCss, dirty);
              setDirty(false);
            }}
          >
            {pagePublished ? "Save & publish" : "Publish page"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes?")) return;
              setDirty(false);
              onClose();
            }}
          >
            Close
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red border-b px-4 py-2 text-sm">
          {saveError}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex flex-col gap-0 lg:flex-row">
          {/* CANVAS — live preview inside the site's palette. */}
          <div className="min-w-0 flex-1 p-4">
            <div
              style={paletteVars}
              className="bg-osrs-surface-0 text-osrs-parchment overflow-hidden rounded-xl"
              onClick={() => setSelectedId(null)}
            >
              {/* Mock tenant header — matches app/sites/[sub]/layout.tsx. */}
              <div className="border-osrs-bronze/30 bg-osrs-surface-1/80 border-b px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {group.icon_url && (
                      <img src={group.icon_url} alt="" className="size-6 rounded object-cover" />
                    )}
                    <span className="text-osrs-gold font-display text-sm font-bold">
                      {group.name}
                    </span>
                  </span>
                  <span className="text-osrs-parchment-dark/70 flex gap-2 text-xs">
                    {site.nav.length > 0 ? (
                      site.nav.map((n, i) => <span key={i}>{n.label}</span>)
                    ) : (
                      <span className="italic">no nav entries yet</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <CanvasDropArea empty={blocks.length === 0}>
                    {blocks.map((b) => (
                      <SortableCanvasBlock
                        key={b.id as string}
                        block={b}
                        group={group}
                        selected={selectedId === (b.id as string)}
                        onSelect={() => setSelectedId(b.id as string)}
                        onRemove={() => {
                          mutate(blocks.filter((x) => x.id !== b.id));
                          if (selectedId === (b.id as string)) setSelectedId(null);
                        }}
                      />
                    ))}
                  </CanvasDropArea>
                </SortableContext>
              </div>

              {/* Mock tenant footer. */}
              <div className="border-osrs-bronze/30 bg-osrs-surface-1/80 text-osrs-parchment-dark/60 flex justify-between border-t px-4 py-2 text-[10px]">
                <span>Hosted by DropTracker</span>
                <span className="underline">Report this site</span>
              </div>
            </div>
          </div>

          {/* BUILDER PANEL */}
          <div className="border-osrs-bronze/30 w-full shrink-0 border-t p-4 lg:w-80 lg:border-t-0 lg:border-l">
            <div className="space-y-4 lg:sticky lg:top-4">
              <TrashZone active={dragging?.fromCanvas === true} />

              {selected ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-osrs-gold text-sm font-semibold">
                      {BLOCK_META[selected.type as string]?.label ?? "Block"} settings
                    </h3>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        title="Duplicate block"
                        className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-2 py-0.5 text-xs"
                        disabled={!canAdd}
                        onClick={() => {
                          const i = ids.indexOf(selectedId!);
                          const copy = { ...selected, id: newBlockId() };
                          const next = [...blocks];
                          next.splice(i + 1, 0, copy);
                          mutate(next);
                          setSelectedId(copy.id as string);
                        }}
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        title="Deselect"
                        className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-2 py-0.5 text-xs"
                        onClick={() => setSelectedId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="border-osrs-bronze/30 rounded-lg border p-3">
                    <BlockForm
                      block={selected}
                      groupId={site.group_id}
                      onChange={(nb) =>
                        mutate(blocks.map((x) => ((x.id as string) === selectedId ? nb : x)))
                      }
                    />
                  </div>
                  <p className="text-osrs-parchment-dark/50 mt-2 text-[11px]">
                    Changes appear in the preview immediately; “Save draft” persists them.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-osrs-gold mb-1 text-sm font-semibold">Add blocks</h3>
                  <p className="text-osrs-parchment-dark/60 mb-2 text-[11px]">
                    Drag onto the page, or click to add at the end. Click a placed block to edit
                    its settings.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BLOCK_CATALOG.map((def) => {
                      const allowed = canAddType(def.type);
                      return (
                        <div
                          key={def.type}
                          className={allowed ? "" : "pointer-events-none opacity-40"}
                          title={
                            allowed
                              ? undefined
                              : `Limit reached (${htmlMax} per page) — remove one to add another.`
                          }
                          onClick={() => allowed && insertFromPalette(def.type, null)}
                        >
                          <PaletteItem type={def.type} />
                        </div>
                      );
                    })}
                  </div>
                  {htmlCount >= htmlMax && (
                    <p className="text-osrs-parchment-dark/60 mt-2 text-[11px]">
                      Custom HTML: {htmlCount}/{htmlMax} used on this page.
                    </p>
                  )}
                  {!canAdd && (
                    <p className="text-osrs-red mt-2 text-xs">
                      Page limit reached ({meta.limits.max_blocks_per_page} blocks).
                    </p>
                  )}
                </div>
              )}

              {/* Page-scoped CSS — applies to THIS page only, on top of the
                  site-wide sheet in Appearance. */}
              <details className="border-osrs-bronze/30 rounded border p-2">
                <summary className="text-osrs-parchment-dark/80 cursor-pointer text-xs font-medium">
                  Page CSS {pageCss.trim() ? "(in use)" : "(optional)"}
                </summary>
                <p className="text-osrs-parchment-dark/60 mt-2 text-[11px]">
                  Styles just this page, applied after your site-wide CSS. Saved
                  with the draft and validated server-side.
                </p>
                <textarea
                  className="border-osrs-bronze/50 bg-osrs-surface-2 text-osrs-parchment mt-2 min-h-28 w-full rounded border p-2 font-mono text-[11px]"
                  value={pageCss}
                  placeholder=".about-us .value-card { border-radius: 20px; }"
                  onChange={(e) => {
                    setPageCss(e.target.value);
                    setDirty(true);
                  }}
                />
              </details>
            </div>
          </div>
        </div>

        <DragOverlay>
          {dragging && (
            <div className="bg-osrs-surface-3 border-osrs-gold/60 rounded border px-3 py-1.5 text-sm font-medium shadow-lg">
              {dragging.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
