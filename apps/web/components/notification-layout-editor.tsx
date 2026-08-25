"use client";

/**
 * Notification Components-V2 builder — the components counterpart of
 * embed-editor.tsx, over the same block DSL the event layout editor uses
 * (backend services/component_layout.py).
 *
 * A group either sends a notification type as an embed or as components;
 * Discord will not accept both in one message. So each type here has three
 * states: on the embed (no layout), authored but not live, and live. Only the
 * third changes what members receive, and it is deliberately a separate switch
 * from saving — an author can build and preview for as long as they like
 * without anyone seeing it.
 *
 * The preview reproduces the renderer's dropping rules, not just its markdown:
 * a line whose token has no value disappears, a thumbnail or image whose URL
 * did not resolve is left out, and a layout with nothing left to say falls back
 * to the embed. Without that, the preview promises screenshots and character
 * models that most notifications do not carry.
 */
import { useMemo, useState, useTransition } from "react";
import type {
  NotificationLayout,
  NotificationLayoutBlock,
  NotificationLayoutEntry,
  NotificationLayoutInput,
  NotificationLayoutMeta,
  NotificationLayoutTypeMeta,
} from "@droptracker/api-types";
import {
  resetGroupNotificationLayoutAction,
  saveGroupNotificationLayoutAction,
} from "@/app/(site)/(admin)/groups/[id]/embeds/notification-layout-actions";
import { getErrorMessage } from "@/lib/errors";
import { DiscordMessageFrame, HiddenOnError, PreviewLines } from "@/components/components-v2-preview";
import { renderNotificationPreview, sampleMap } from "@/lib/components-v2";
import { Alert, Card, fieldInputClass } from "@/components/ui";
import { MessageStyleChooser } from "@/components/message-style";

/* ------------------------------------------------------------------ */
/* Draft model                                                          */
/* ------------------------------------------------------------------ */
type BlockType = NotificationLayoutBlock["type"];
type ButtonDraft = { label: string; url: string };
type BlockDraft = {
  type: BlockType;
  content: string;
  thumbnail: string;
  divider: boolean;
  largeGap: boolean;
  urls: string[];
  buttons: ButtonDraft[];
};
type Draft = { accent: string; blocks: BlockDraft[] };

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Text",
  section: "Text + thumbnail",
  separator: "Divider",
  media: "Images",
  buttons: "Buttons",
};

const ADDABLE: BlockType[] = ["text", "section", "separator", "media", "buttons"];

function blockDraft(block: NotificationLayoutBlock): BlockDraft {
  return {
    type: block.type,
    content: "content" in block ? (block.content ?? "") : "",
    thumbnail: block.type === "section" ? (block.thumbnail ?? "") : "",
    divider: block.type === "separator" ? (block.divider ?? true) : true,
    largeGap: block.type === "separator" && block.spacing === "large",
    urls: block.type === "media" ? [...block.urls] : [],
    buttons:
      block.type === "buttons" ? block.buttons.map((b) => ({ label: b.label, url: b.url })) : [],
  };
}

function draftFrom(layout: NotificationLayout | null | undefined): Draft {
  if (!layout) return { accent: "", blocks: [] };
  return { accent: layout.accent_color ?? "", blocks: layout.blocks.map(blockDraft) };
}

function emptyBlock(type: BlockType): BlockDraft {
  return {
    type,
    content: "",
    thumbnail: "",
    divider: true,
    largeGap: false,
    urls: type === "media" ? ["{image_url}"] : [],
    buttons: type === "buttons" ? [{ label: "View profile", url: "" }] : [],
  };
}

function toInput(draft: Draft, active: boolean): NotificationLayoutInput {
  const blocks: NotificationLayoutBlock[] = draft.blocks.map((b) => {
    switch (b.type) {
      case "text":
        return { type: "text", content: b.content };
      case "section":
        return {
          type: "section",
          content: b.content,
          thumbnail: b.thumbnail.trim() || null,
        };
      case "separator":
        return { type: "separator", divider: b.divider, spacing: b.largeGap ? "large" : "small" };
      case "media":
        return { type: "media", urls: b.urls.map((u) => u.trim()).filter(Boolean) };
      case "buttons":
        return {
          type: "buttons",
          buttons: b.buttons
            .filter((btn) => btn.label.trim())
            .map((btn) => ({ label: btn.label.trim(), url: btn.url.trim() })),
        };
    }
  });
  return {
    accent_color: /^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : null,
    blocks,
    active,
  };
}

/* ------------------------------------------------------------------ */
/* Preview                                                              */
/* ------------------------------------------------------------------ */
/** What the notification carries. "Sparse" is the common case in production:
 * no screenshot, no character render, no points — the values whose absence
 * silently removes lines. */
type PreviewMode = "sample" | "sparse" | "raw";

const PREVIEW_MODES: { key: PreviewMode; label: string; hint: string }[] = [
  { key: "sample", label: "Typical", hint: "Every value filled in." },
  {
    key: "sparse",
    label: "No images or extras",
    hint: "What a member sees when they sent no screenshot, have no character render and earned no points.",
  },
  { key: "raw", label: "Raw tokens", hint: "The template as written, nothing substituted." },
];

function NotificationPreview({
  draft,
  typeMeta,
  mode,
}: {
  draft: Draft;
  typeMeta: NotificationLayoutTypeMeta | undefined;
  mode: PreviewMode;
}) {
  const substitute = mode !== "raw";
  const samples = useMemo(
    () => sampleMap(typeMeta?.tokens ?? [], mode === "sparse"),
    [typeMeta, mode],
  );
  // The same resolution the sender performs, so what is drawn below is what
  // Discord would be handed.
  const blocks = useMemo(
    () => renderNotificationPreview(draft.blocks, samples, substitute),
    [draft.blocks, samples, substitute],
  );

  const accent = /^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : "#1e1f22";

  if (!draft.blocks.length) {
    return (
      <DiscordMessageFrame accent={accent}>
        <div className="text-sm italic text-[#949ba4]">Add blocks to build this message.</div>
      </DiscordMessageFrame>
    );
  }

  if (!blocks.length) {
    return (
      <Alert variant="info">
        Nothing in this layout resolves for this case, so the notification would fall back to the
        embed. Keep at least one line whose values are always present.
      </Alert>
    );
  }

  return (
    <DiscordMessageFrame accent={accent}>
      {blocks.map((block, i) => {
        if (block.kind === "separator")
          return (
            <hr
              key={i}
              className={`${block.largeGap ? "my-4" : "my-2"} ${
                block.divider ? "border-[#3f4147]" : "border-transparent"
              }`}
            />
          );
        if (block.kind === "text")
          return (
            <div key={i} className="space-y-0.5">
              <PreviewLines text={block.text} keyPrefix={`b${i}`} />
            </div>
          );
        if (block.kind === "section")
          return block.thumbnail ? (
            <div key={i} className="flex items-start gap-3">
              <div className="min-w-0 grow space-y-0.5">
                <PreviewLines text={block.text} keyPrefix={`b${i}`} />
              </div>
              <HiddenOnError
                src={block.thumbnail}
                className="h-14 w-14 shrink-0 rounded object-contain"
              />
            </div>
          ) : (
            <div key={i} className="space-y-0.5">
              <PreviewLines text={block.text} keyPrefix={`b${i}`} />
            </div>
          );
        if (block.kind === "media")
          return (
            <div key={i} className={block.urls.length > 1 ? "grid grid-cols-2 gap-1" : "block"}>
              {block.urls.map((url, j) =>
                substitute ? (
                  <HiddenOnError key={j} src={url} className="max-h-56 w-full rounded object-cover" />
                ) : (
                  <div
                    key={j}
                    className="flex h-20 items-center justify-center rounded bg-[#3f4147] px-2 text-center text-xs text-[#c9cdfb]"
                  >
                    {url}
                  </div>
                ),
              )}
            </div>
          );
        return (
          <div key={i} className="flex flex-wrap gap-2 pt-1">
            {block.buttons.map((b, j) => (
              <span
                key={j}
                className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-medium text-white"
              >
                {b.label}
                <span className="ml-1 opacity-70">↗</span>
              </span>
            ))}
          </div>
        );
      })}
    </DiscordMessageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Block form                                                           */
/* ------------------------------------------------------------------ */
function BlockForm({
  block,
  index,
  count,
  limits,
  onChange,
  onMove,
  onRemove,
}: {
  block: BlockDraft;
  index: number;
  count: number;
  limits: NotificationLayoutMeta["limits"];
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const maxTextLen = limits.max_text_len ?? 3500;
  const maxMedia = limits.max_media_items ?? 10;
  const maxButtons = limits.max_buttons ?? 5;

  const updateButton = (i: number, patch: Partial<ButtonDraft>) =>
    onChange({ buttons: block.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <div className="border-osrs-bronze/25 rounded border p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-osrs-gold-bright text-xs font-semibold">
          {BLOCK_LABELS[block.type]}
        </span>
        <span className="grow" />
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="text-osrs-parchment-dark/70 hover:text-osrs-parchment px-1 text-sm disabled:opacity-30"
          aria-label="Move block up"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className="text-osrs-parchment-dark/70 hover:text-osrs-parchment px-1 text-sm disabled:opacity-30"
          aria-label="Move block down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-osrs-red/80 hover:text-osrs-red px-1 text-sm"
          aria-label="Remove block"
        >
          ✕
        </button>
      </div>

      {(block.type === "text" || block.type === "section") && (
        <>
          <textarea
            value={block.content}
            maxLength={maxTextLen}
            rows={block.type === "section" ? 4 : 2}
            onChange={(e) => onChange({ content: e.target.value })}
            className={`${fieldInputClass} w-full`}
            placeholder={
              "# Big, ### small, -# subtext, **markdown**, {tokens}…\nA line with an unfilled {token} is dropped."
            }
          />
          {block.type === "section" && (
            <input
              type="text"
              value={block.thumbnail}
              maxLength={500}
              onChange={(e) => onChange({ thumbnail: e.target.value })}
              className={`${fieldInputClass} mt-2 w-full`}
              placeholder="Thumbnail URL or token, e.g. {gear_image_url}"
            />
          )}
        </>
      )}

      {block.type === "separator" && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-osrs-parchment-dark/80 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={block.divider}
              onChange={(e) => onChange({ divider: e.target.checked })}
              className="accent-osrs-gold"
            />
            Draw a line
          </label>
          <label className="text-osrs-parchment-dark/80 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={block.largeGap}
              onChange={(e) => onChange({ largeGap: e.target.checked })}
              className="accent-osrs-gold"
            />
            Large gap
          </label>
        </div>
      )}

      {block.type === "media" && (
        <div className="space-y-2">
          {block.urls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                maxLength={500}
                onChange={(e) =>
                  onChange({ urls: block.urls.map((u, j) => (j === i ? e.target.value : u)) })
                }
                className={`${fieldInputClass} w-full`}
                placeholder="https://… or {image_url}"
              />
              <button
                type="button"
                onClick={() => onChange({ urls: block.urls.filter((_, j) => j !== i) })}
                className="text-osrs-red/80 hover:text-osrs-red shrink-0 text-sm"
                aria-label={`Remove image ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={block.urls.length >= maxMedia}
            onClick={() => onChange({ urls: [...block.urls, ""] })}
            className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs disabled:opacity-40"
          >
            + Add image
          </button>
          <p className="text-osrs-parchment-dark/50 text-xs">
            Images whose token has no value are left out; if none are left, the whole gallery is.
          </p>
        </div>
      )}

      {block.type === "buttons" && (
        <div className="space-y-2">
          {block.buttons.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={b.label}
                maxLength={limits.max_label_len ?? 80}
                onChange={(e) => updateButton(i, { label: e.target.value })}
                className={`${fieldInputClass} w-32 grow`}
                placeholder="Label"
              />
              <input
                type="text"
                value={b.url}
                maxLength={500}
                onChange={(e) => updateButton(i, { url: e.target.value })}
                className={`${fieldInputClass} w-40 grow-[2]`}
                placeholder="https://… or {video_url}"
              />
              <button
                type="button"
                onClick={() => onChange({ buttons: block.buttons.filter((_, j) => j !== i) })}
                className="text-osrs-red/80 hover:text-osrs-red shrink-0 text-sm"
                aria-label={`Remove button ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={block.buttons.length >= maxButtons}
            onClick={() => onChange({ buttons: [...block.buttons, { label: "", url: "" }] })}
            className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs disabled:opacity-40"
          >
            + Add button
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */
export function NotificationLayoutEditor({
  groupId,
  entries: initialEntries,
  meta,
}: {
  groupId: number;
  entries: NotificationLayoutEntry[];
  meta: NotificationLayoutMeta;
}) {
  const orderedTypes = useMemo(
    () => meta.types.filter((t) => initialEntries.some((e) => e.notification_type === t.key)),
    [meta, initialEntries],
  );
  const groups = useMemo(() => {
    const out: { group: string; types: NotificationLayoutTypeMeta[] }[] = [];
    for (const t of orderedTypes) {
      const bucket = out.find((g) => g.group === t.group);
      if (bucket) bucket.types.push(t);
      else out.push({ group: t.group, types: [t] });
    }
    return out;
  }, [orderedTypes]);

  const [entries, setEntries] = useState<Map<string, NotificationLayoutEntry>>(
    () => new Map(initialEntries.map((e) => [e.notification_type, e])),
  );
  const [selected, setSelected] = useState<string>(orderedTypes[0]?.key ?? "pb");
  const [draft, setDraft] = useState<Draft>(() => {
    const e = initialEntries.find((x) => x.notification_type === (orderedTypes[0]?.key ?? ""));
    return draftFrom(e?.custom ?? e?.default ?? null);
  });
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<PreviewMode>("sample");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const entry = entries.get(selected);
  const hasSaved = Boolean(entry?.custom);
  const isLive = Boolean(entry?.active);
  const typeMeta = orderedTypes.find((t) => t.key === selected);
  const maxBlocks = meta.limits.max_blocks ?? 30;

  const selectType = (key: string) => {
    if (dirty && !window.confirm("Discard unsaved changes to this layout?")) return;
    setSelected(key);
    const e = entries.get(key);
    setDraft(draftFrom(e?.custom ?? e?.default ?? null));
    setDirty(false);
    setMessage(null);
  };

  const update = (mutate: (d: Draft) => Draft) => {
    setDraft(mutate);
    setDirty(true);
  };

  const updateBlock = (i: number, patch: Partial<BlockDraft>) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const moveBlock = (i: number, dir: -1 | 1) =>
    update((d) => {
      const blocks = [...d.blocks];
      const j = i + dir;
      const a = blocks[i];
      const b = blocks[j];
      if (a === undefined || b === undefined) return d;
      blocks[i] = b;
      blocks[j] = a;
      return { ...d, blocks };
    });

  const addBlock = (type: BlockType) =>
    update((d) => ({ ...d, blocks: [...d.blocks, emptyBlock(type)] }));

  /** Save the draft; `active` decides whether members see it. */
  const persist = (active: boolean, successText: string) => {
    if (!draft.blocks.length) {
      setMessage({ tone: "error", text: "The layout needs at least one block." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveGroupNotificationLayoutAction(
          groupId,
          selected,
          toInput(draft, active),
        );
        if (!res.ok) {
          setMessage({ tone: "error", text: res.error });
          return;
        }
        setEntries((m) => {
          const next = new Map(m);
          const cur = next.get(selected);
          if (cur) next.set(selected, { ...cur, custom: res.data.layout, active: res.data.active });
          return next;
        });
        setDraft(draftFrom(res.data.layout));
        setDirty(false);
        setMessage({ tone: "success", text: successText });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const save = () => persist(isLive, isLive ? "Saved — members are seeing this now." : "Saved as a draft. Nothing has changed for your members yet.");

  const goLive = () => {
    if (
      !window.confirm(
        `Send every ${typeMeta?.label.toLowerCase() ?? selected} notification as components ` +
          "from now on? Every member of your group will see the blocks below instead of the " +
          "embed. You can switch back at any time.",
      )
    )
      return;
    persist(true, "Switched over — this type now sends as components.");
  };

  const goDraft = () => persist(false, "Switched back to the embed. Your layout is kept.");

  const revert = () => {
    if (!window.confirm("Delete this layout and go back to the embed template?")) return;
    startTransition(async () => {
      try {
        const res = await resetGroupNotificationLayoutAction(groupId, selected);
        if (!res.ok) {
          setMessage({ tone: "error", text: res.error });
          return;
        }
        setEntries((m) => {
          const next = new Map(m);
          const cur = next.get(selected);
          if (cur) next.set(selected, { ...cur, custom: null, active: false });
          return next;
        });
        setDraft(draftFrom(entry?.default ?? null));
        setDirty(false);
        setMessage({ tone: "success", text: "Deleted — this type sends its embed again." });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const copyToken = (token: string) => {
    void navigator.clipboard?.writeText(`{${token}}`);
  };

  const modeHint = PREVIEW_MODES.find((m) => m.key === mode)?.hint ?? "";

  return (
    <div className="space-y-4">
      {/* Type selector, grouped */}
      <div className="space-y-2">
        {groups.map(({ group, types }) => (
          <div key={group} className="flex flex-wrap items-center gap-1">
            <span className="text-osrs-parchment-dark/50 w-24 shrink-0 text-[11px] tracking-wide uppercase">
              {group}
            </span>
            {types.map((t) => {
              const e = entries.get(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectType(t.key)}
                  className={`rounded px-2.5 py-1 text-sm transition-colors ${
                    t.key === selected
                      ? "bg-osrs-bronze text-osrs-parchment"
                      : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
                  }`}
                >
                  {t.label}
                  {e?.active ? (
                    <span className="text-osrs-green ml-1" title="Sending as components">
                      ●
                    </span>
                  ) : e?.custom ? (
                    <span
                      className="text-osrs-gold-bright ml-1"
                      title="Sending the embed — an unused layout is saved here"
                    >
                      ○
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-osrs-parchment-dark/60 text-xs">
        {typeMeta?.description}{" "}
        {isLive
          ? "Currently sent as components."
          : hasSaved
            ? "Currently sent as an embed; the layout saved here is not in use."
            : "Currently sent as an embed. The blocks below start as a copy of that embed, so you can switch over and adjust from there."}
      </p>
      <p className="text-osrs-parchment-dark/50 text-xs">
        A green ● marks a type sent as components; a gold ○ marks one with a saved layout that
        is not in use.
      </p>

      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Blocks form */}
        <Card padding="p-5" className="space-y-4">
          <div>
            <label className="text-osrs-parchment mb-1 block text-sm font-medium">
              Accent color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : "#1e1f22"}
                onChange={(e) => update((d) => ({ ...d, accent: e.target.value }))}
                className="border-osrs-bronze/40 h-9 w-10 cursor-pointer rounded border bg-transparent"
                aria-label="Accent color"
              />
              <input
                type="text"
                value={draft.accent}
                onChange={(e) => update((d) => ({ ...d, accent: e.target.value }))}
                className={`${fieldInputClass} w-full`}
                placeholder="#c8aa6e (blank = none)"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-osrs-parchment text-sm font-medium">
                Blocks
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs font-normal">
                  {draft.blocks.length}/{maxBlocks}
                </span>
              </span>
              <div className="flex flex-wrap gap-1">
                {ADDABLE.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={draft.blocks.length >= maxBlocks}
                    onClick={() => addBlock(t)}
                    className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs disabled:opacity-40"
                  >
                    + {BLOCK_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {draft.blocks.map((b, i) => (
                <BlockForm
                  key={i}
                  block={b}
                  index={i}
                  count={draft.blocks.length}
                  limits={meta.limits}
                  onChange={(patch) => updateBlock(i, patch)}
                  onMove={(dir) => moveBlock(i, dir)}
                  onRemove={() =>
                    update((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }))
                  }
                />
              ))}
              {draft.blocks.length === 0 && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  No blocks yet — add a text block to get started.
                </p>
              )}
            </div>
          </div>

          <MessageStyleChooser
            typeLabel={typeMeta?.label ?? selected}
            isComponents={isLive}
            disabled={pending}
            canUseComponents={draft.blocks.length > 0}
            onChoose={(components) => (components ? goLive() : goDraft())}
          />

          <div className="border-osrs-bronze/25 space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={pending || !dirty}
                className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              {hasSaved && (
                <button
                  type="button"
                  onClick={revert}
                  disabled={pending}
                  className="text-osrs-red/80 hover:text-osrs-red px-2 py-2 text-sm disabled:opacity-50"
                >
                  Delete layout
                </button>
              )}
              {dirty && <span className="text-osrs-parchment-dark/60 text-xs">Unsaved changes</span>}
            </div>
          </div>
        </Card>

        {/* Preview + tokens */}
        <div className="space-y-4">
          <Card padding="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-osrs-gold text-sm font-semibold">Live preview</h3>
              <div className="border-osrs-bronze/30 inline-flex gap-1 rounded border p-0.5">
                {PREVIEW_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      m.key === mode
                        ? "bg-osrs-bronze text-osrs-parchment"
                        : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <NotificationPreview draft={draft} typeMeta={typeMeta} mode={mode} />
            <p className="text-osrs-parchment-dark/50 mt-2 text-xs">{modeHint}</p>
          </Card>

          <Card padding="p-5">
            <h3 className="text-osrs-gold mb-2 text-sm font-semibold">
              Tokens for {typeMeta?.label.toLowerCase() ?? selected}
            </h3>
            <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
              Click a token to copy it, then paste it into any text, thumbnail, image or button
              link. Tokens marked <span className="text-osrs-parchment-dark/80">optional</span> are
              often empty — keep each one on its own line so only that line disappears.
            </p>
            <div className="space-y-1.5">
              {(typeMeta?.tokens ?? []).map((d) => (
                <button
                  key={d.token}
                  type="button"
                  onClick={() => copyToken(d.token)}
                  title="Click to copy"
                  className="hover:bg-osrs-bronze/20 flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left"
                >
                  <code className="text-osrs-gold-bright shrink-0 text-xs">{`{${d.token}}`}</code>
                  <span className="text-osrs-parchment-dark/70 truncate text-xs">{d.help}</span>
                  {d.optional && (
                    <span className="text-osrs-parchment-dark/40 ml-auto shrink-0 text-[10px] uppercase">
                      optional
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
