"use client";

/**
 * Event message-layout editor (web66a, custom_embeds entitlement) — the
 * Components-V2 analogue of embed-editor.tsx. Edits the block DSL rendered
 * by the bot for event Discord messages (backend
 * services/event_message_layouts.py): text / section / separator /
 * standings / buttons blocks with `{token}` substitution.
 *
 * Two scopes share this editor:
 *  - group:  the group's default layouts (groups/[id]/embeds, Event
 *    messages tab) — saved rows apply to every event the group runs.
 *  - event:  one event's overrides (Discord settings, "Message layouts")
 *    — seeded from the group's effective layout, reverting returns to it.
 *
 * The preview mirrors the renderer's per-line token-drop rule: with sample
 * data on, a line whose token has no sample vanishes exactly like a line
 * with a None context value does in production.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  EventLayoutBlock,
  EventLayoutButton,
  EventLayoutMeta,
  EventLayoutTypeMeta,
  EventMessageLayout,
  EventMessageLayoutInput,
} from "@droptracker/api-types";
import {
  getEventLayoutMetaAction,
  getEventLayoutsAction,
  resetEventLayoutAction,
  resetGroupEventLayoutAction,
  saveEventLayoutAction,
  saveGroupEventLayoutAction,
} from "@/app/(site)/(admin)/groups/[id]/embeds/event-layout-actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Card, fieldInputClass } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Scope + entry model                                                  */
/* ------------------------------------------------------------------ */
export type LayoutScope =
  | { kind: "group"; groupId: number }
  | { kind: "event"; groupId: number | null; eventId: number };

/** One message type's state: the saved custom layout (group row or event
 * override) and the base it falls back to (system default / group layout). */
export type LayoutEntry = {
  message_type: string;
  saved: EventMessageLayout | null;
  base: EventMessageLayout;
};

type ButtonDraft = { label: string; url: string; launch: boolean; view: string };
type BlockDraft = {
  type: EventLayoutBlock["type"];
  content: string;
  thumbnail: string;
  title: string;
  limit: number;
  buttons: ButtonDraft[];
};
type Draft = { accent: string; blocks: BlockDraft[] };

function blockDraft(block: EventLayoutBlock): BlockDraft {
  return {
    type: block.type,
    content: "content" in block ? (block.content ?? "") : "",
    thumbnail: block.type === "section" ? (block.thumbnail ?? "") : "",
    title: block.type === "standings" ? (block.title ?? "") : "",
    limit: block.type === "standings" ? (block.limit ?? 5) : 5,
    buttons:
      block.type === "buttons"
        ? block.buttons.map((b) => ({
            label: b.label,
            url: b.url ?? "",
            launch: Boolean(b.launch),
            view: b.view ?? "",
          }))
        : [],
  };
}

function draftFrom(layout: EventMessageLayout | null | undefined): Draft {
  if (!layout) return { accent: "", blocks: [] };
  return { accent: layout.accent_color ?? "", blocks: layout.blocks.map(blockDraft) };
}

function emptyBlock(type: EventLayoutBlock["type"]): BlockDraft {
  return {
    type,
    content: "",
    thumbnail: "",
    title: type === "standings" ? "**Standings**" : "",
    limit: 5,
    buttons: type === "buttons" ? [{ label: "View event", url: "{event_url}", launch: false, view: "" }] : [],
  };
}

function toInput(draft: Draft): EventMessageLayoutInput {
  const blocks: EventLayoutBlock[] = draft.blocks.map((b) => {
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
        return { type: "separator" };
      case "standings":
        return {
          type: "standings",
          limit: b.limit,
          title: b.title.trim() || null,
        };
      case "buttons":
        return {
          type: "buttons",
          buttons: b.buttons
            .filter((btn) => btn.label.trim())
            .map((btn): EventLayoutButton => {
              if (btn.launch) {
                return {
                  label: btn.label.trim(),
                  launch: true,
                  ...(btn.view.trim() ? { view: btn.view.trim() } : {}),
                };
              }
              return { label: btn.label.trim(), url: btn.url.trim() };
            }),
        };
    }
  });
  return {
    accent_color: /^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : null,
    blocks,
  };
}

/* ------------------------------------------------------------------ */
/* Preview                                                              */
/* ------------------------------------------------------------------ */
const TOKEN_RE = /\{[a-z_]+\}/;

/** Mirror of the backend's per-line substitution: tokens with samples are
 * replaced, and (with samples on) a line still holding a token is dropped. */
function resolveLines(text: string, samples: Map<string, string>, useSamples: boolean): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    let line = rawLine;
    if (useSamples) {
      for (const [token, sample] of samples) line = line.split(token).join(sample);
      if (TOKEN_RE.test(line)) continue;
    }
    out.push(line);
  }
  return out;
}

function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{[a-z_]+\})/g;
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={key}>{part.slice(2, -2)}</u>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{part.slice(2, -2)}</s>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={key} className="rounded bg-black/40 px-1 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link)
      return (
        <span key={key} className="text-[#00a8fc] hover:underline">
          {link[1]}
        </span>
      );
    if (/^\{[a-z_]+\}$/.test(part))
      return (
        <span key={key} className="rounded bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">
          {part}
        </span>
      );
    return <span key={key}>{part}</span>;
  });
}

/** One markdown-ish line with Discord heading/subtext prefixes. */
function PreviewLine({ line, keyPrefix }: { line: string; keyPrefix: string }) {
  if (line.startsWith("## "))
    return (
      <div className="text-[17px] font-bold text-white">{formatInline(line.slice(3), keyPrefix)}</div>
    );
  if (line.startsWith("### "))
    return (
      <div className="text-[15px] font-semibold text-white">
        {formatInline(line.slice(4), keyPrefix)}
      </div>
    );
  if (line.startsWith("-# "))
    return (
      <div className="text-xs text-[#949ba4]">{formatInline(line.slice(3), keyPrefix)}</div>
    );
  return <div className="text-sm text-[#dbdee1]">{formatInline(line, keyPrefix)}</div>;
}

function PreviewLines({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <PreviewLine key={i} line={line} keyPrefix={`${keyPrefix}-${i}`} />
      ))}
    </>
  );
}

function HiddenOnError({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) return null;
  // Plain <img>: preview URLs are arbitrary user input, not next/image targets.
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function ComponentsPreview({
  draft,
  typeMeta,
  meta,
  useSamples,
}: {
  draft: Draft;
  typeMeta: EventLayoutTypeMeta | undefined;
  meta: EventLayoutMeta;
  useSamples: boolean;
}) {
  const samples = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of typeMeta?.tokens ?? []) map.set(`{${t.token}}`, t.sample);
    return map;
  }, [typeMeta]);

  const accent = /^#[0-9a-fA-F]{6}$/.test(draft.accent) ? draft.accent : "#1e1f22";
  const now = new Date();
  const timeText = `Today at ${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const rendered: React.ReactNode[] = [];
  draft.blocks.forEach((block, i) => {
    if (block.type === "separator") {
      rendered.push(<hr key={i} className="my-2 border-[#3f4147]" />);
      return;
    }
    if (block.type === "text" || block.type === "section") {
      const lines = resolveLines(block.content, samples, useSamples);
      if (useSamples && lines.join("").trim() === "") return;
      const body = <PreviewLines text={lines.join("\n")} keyPrefix={`b${i}`} />;
      if (block.type === "section" && block.thumbnail.trim()) {
        const thumb = useSamples
          ? resolveLines(block.thumbnail, samples, true).join("")
          : "";
        rendered.push(
          <div key={i} className="flex items-start gap-3">
            <div className="min-w-0 grow space-y-0.5">{body}</div>
            {thumb ? (
              <HiddenOnError src={thumb} className="h-14 w-14 shrink-0 rounded object-contain" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[#3f4147] text-lg">
                🖼️
              </div>
            )}
          </div>,
        );
      } else {
        rendered.push(
          <div key={i} className="space-y-0.5">
            {body}
          </div>,
        );
      }
      return;
    }
    if (block.type === "standings") {
      const rows = meta.sample_standings.slice(0, block.limit);
      rendered.push(
        <div key={i} className="space-y-0.5">
          {block.title.trim() && <PreviewLine line={block.title} keyPrefix={`b${i}t`} />}
          {rows.map((r, j) => (
            <div key={j} className="text-sm text-[#dbdee1]">
              {MEDALS[j] ?? `#${j + 1}`} <strong>{r.name}</strong> —{" "}
              <code className="rounded bg-black/40 px-1 text-[0.9em]">{r.score} pts</code>
            </div>
          ))}
          {!typeMeta?.supports_standings && (
            <div className="text-xs italic text-[#949ba4]">
              This message type doesn&apos;t receive standings — this block will show &quot;No
              teams yet.&quot;
            </div>
          )}
        </div>,
      );
      return;
    }
    if (block.type === "buttons") {
      const buttons = block.buttons.filter((b) => b.label.trim());
      if (!buttons.length) return;
      rendered.push(
        <div key={i} className="flex flex-wrap gap-2 pt-1">
          {buttons.map((b, j) => (
            <span
              key={j}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                b.launch ? "bg-[#5865f2] text-white" : "bg-[#4e5058] text-white"
              }`}
            >
              {resolveLines(b.label, samples, useSamples).join("") || b.label}
              {!b.launch && <span className="ml-1 opacity-70">↗</span>}
            </span>
          ))}
        </div>,
      );
    }
  });

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="bg-osrs-gold/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg">
          <img src="/images/logo.png" alt="DropTracker" className="h-6 w-6" />
        </div>
        <div className="min-w-0 grow">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-white">DropTracker</span>
            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">{timeText}</span>
          </div>
          <div
            className="mt-1 max-w-[520px] space-y-1.5 rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
            style={{ borderLeftColor: accent }}
          >
            {rendered.length ? (
              rendered
            ) : (
              <div className="text-sm italic text-[#949ba4]">Add blocks to build this message.</div>
            )}
            <hr className="my-2 border-[#3f4147]" />
            <div className="text-xs text-[#949ba4]">
              📅 {useSamples ? "Summer Loot Sweep" : "{event_name}"} • the universal event footer is
              always appended
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block form                                                           */
/* ------------------------------------------------------------------ */
const BLOCK_LABELS: Record<EventLayoutBlock["type"], string> = {
  text: "Text",
  section: "Text + thumbnail",
  separator: "Divider",
  standings: "Standings",
  buttons: "Buttons",
};

function BlockForm({
  block,
  index,
  count,
  maxTextLen,
  onChange,
  onMove,
  onRemove,
}: {
  block: BlockDraft;
  index: number;
  count: number;
  maxTextLen: number;
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
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
            placeholder={"## Heading, **markdown**, {tokens}…\nLines with an unfilled {token} are dropped."}
          />
          {block.type === "section" && (
            <input
              type="text"
              value={block.thumbnail}
              maxLength={500}
              onChange={(e) => onChange({ thumbnail: e.target.value })}
              className={`${fieldInputClass} mt-2 w-full`}
              placeholder="Thumbnail URL or token, e.g. {completion_icon}"
            />
          )}
        </>
      )}

      {block.type === "standings" && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={block.title}
            maxLength={200}
            onChange={(e) => onChange({ title: e.target.value })}
            className={`${fieldInputClass} w-full`}
            placeholder="**Standings** (optional title)"
          />
          <label className="text-osrs-parchment-dark/80 flex shrink-0 items-center gap-1 text-xs">
            Top
            <select
              value={block.limit}
              onChange={(e) => onChange({ limit: Number(e.target.value) })}
              className={`${fieldInputClass} py-1`}
            >
              {[3, 5, 10, 15, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {block.type === "buttons" && (
        <div className="space-y-2">
          {block.buttons.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={b.label}
                maxLength={80}
                onChange={(e) => updateButton(i, { label: e.target.value })}
                className={`${fieldInputClass} w-32 grow`}
                placeholder="Label"
              />
              {!b.launch && (
                <input
                  type="text"
                  value={b.url}
                  maxLength={500}
                  onChange={(e) => updateButton(i, { url: e.target.value })}
                  className={`${fieldInputClass} w-40 grow-[2]`}
                  placeholder="https://… or {event_url}"
                />
              )}
              <label
                className="text-osrs-parchment-dark/80 flex shrink-0 items-center gap-1 text-xs"
                title="Opens the DropTracker Discord Activity deep-linked to the event"
              >
                <input
                  type="checkbox"
                  checked={b.launch}
                  onChange={(e) => updateButton(i, { launch: e.target.checked })}
                  className="accent-osrs-gold"
                />
                Open in app
              </label>
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
            disabled={block.buttons.length >= 5}
            onClick={() =>
              onChange({
                buttons: [...block.buttons, { label: "", url: "", launch: false, view: "" }],
              })
            }
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
export function EventLayoutEditor({
  scope,
  entries: initialEntries,
  meta,
}: {
  scope: LayoutScope;
  entries: LayoutEntry[];
  meta: EventLayoutMeta;
}) {
  const orderedTypes = useMemo(
    () => meta.types.filter((t) => initialEntries.some((e) => e.message_type === t.key)),
    [meta, initialEntries],
  );
  const groups = useMemo(() => {
    const out: { group: string; types: EventLayoutTypeMeta[] }[] = [];
    for (const t of orderedTypes) {
      const bucket = out.find((g) => g.group === t.group);
      if (bucket) bucket.types.push(t);
      else out.push({ group: t.group, types: [t] });
    }
    return out;
  }, [orderedTypes]);

  const [entries, setEntries] = useState<Map<string, LayoutEntry>>(
    () => new Map(initialEntries.map((e) => [e.message_type, e])),
  );
  const [selected, setSelected] = useState<string>(orderedTypes[0]?.key ?? "event_started");
  const [draft, setDraft] = useState<Draft>(() => {
    const e = initialEntries.find((x) => x.message_type === (orderedTypes[0]?.key ?? ""));
    return draftFrom(e?.saved ?? e?.base ?? null);
  });
  const [dirty, setDirty] = useState(false);
  const [useSamples, setUseSamples] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const entry = entries.get(selected);
  const hasSaved = Boolean(entry?.saved);
  const typeMeta = orderedTypes.find((t) => t.key === selected);
  const maxBlocks = meta.limits.max_blocks ?? 15;
  const maxTextLen = meta.limits.max_text_len ?? 2000;

  const savedNoun = scope.kind === "group" ? "custom layout" : "event override";
  const baseNoun = scope.kind === "group" ? "system default" : "group layout";

  const selectType = (key: string) => {
    if (dirty && !window.confirm("Discard unsaved changes to this layout?")) return;
    setSelected(key);
    const e = entries.get(key);
    setDraft(draftFrom(e?.saved ?? e?.base ?? null));
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

  const addBlock = (type: EventLayoutBlock["type"]) =>
    update((d) => ({ ...d, blocks: [...d.blocks, emptyBlock(type)] }));

  const save = () => {
    if (!draft.blocks.length) {
      setMessage({ tone: "error", text: "The layout needs at least one block." });
      return;
    }
    startTransition(async () => {
      try {
        const input = toInput(draft);
        const res =
          scope.kind === "group"
            ? await saveGroupEventLayoutAction(scope.groupId, selected, input)
            : await saveEventLayoutAction(scope.groupId, scope.eventId, selected, input);
        if (!res.ok) {
          setMessage({ tone: "error", text: res.error });
          return;
        }
        setEntries((m) => {
          const next = new Map(m);
          const cur = next.get(selected);
          if (cur) next.set(selected, { ...cur, saved: res.data });
          return next;
        });
        setDraft(draftFrom(res.data));
        setDirty(false);
        setMessage({
          tone: "success",
          text:
            scope.kind === "group"
              ? "Layout saved — it now applies to all of your events."
              : "Override saved — it applies to this event only.",
        });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const reset = () => {
    if (!window.confirm(`Remove your ${savedNoun} and revert to the ${baseNoun}?`)) return;
    startTransition(async () => {
      try {
        const res =
          scope.kind === "group"
            ? await resetGroupEventLayoutAction(scope.groupId, selected)
            : await resetEventLayoutAction(scope.groupId, scope.eventId, selected);
        if (!res.ok) {
          setMessage({ tone: "error", text: res.error });
          return;
        }
        setEntries((m) => {
          const next = new Map(m);
          const cur = next.get(selected);
          if (cur) next.set(selected, { ...cur, saved: null });
          return next;
        });
        setDraft(draftFrom(entry?.base ?? null));
        setDirty(false);
        setMessage({ tone: "success", text: `Reverted to the ${baseNoun}.` });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const copyToken = (token: string) => {
    void navigator.clipboard?.writeText(`{${token}}`);
  };

  const addableTypes: EventLayoutBlock["type"][] = [
    "text",
    "section",
    "separator",
    ...(typeMeta?.supports_standings ? (["standings"] as const) : []),
    "buttons",
  ];

  return (
    <div className="space-y-4">
      {/* Type selector, grouped */}
      <div className="space-y-2">
        {groups.map(({ group, types }) => (
          <div key={group} className="flex flex-wrap items-center gap-1">
            <span className="text-osrs-parchment-dark/50 w-24 shrink-0 text-[11px] tracking-wide uppercase">
              {group}
            </span>
            {types.map((t) => (
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
                {entries.get(t.key)?.saved ? (
                  <span className="text-osrs-gold-bright ml-1">•</span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="text-osrs-parchment-dark/60 text-xs">
        {typeMeta?.description}{" "}
        {hasSaved
          ? `This type uses your ${savedNoun}.`
          : `This type currently follows the ${baseNoun}.`}
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
                placeholder="#FFD700 (blank = none)"
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
                {addableTypes.map((t) => (
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
                  maxTextLen={maxTextLen}
                  onChange={(patch) => updateBlock(i, patch)}
                  onMove={(dir) => moveBlock(i, dir)}
                  onRemove={() => update((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }))}
                />
              ))}
              {draft.blocks.length === 0 && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  No blocks yet — add a text block to get started.
                </p>
              )}
            </div>
          </div>

          <div className="border-osrs-bronze/25 flex items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : scope.kind === "group" ? "Save layout" : "Save override"}
            </button>
            {hasSaved && (
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-4 py-2 text-sm disabled:opacity-50"
              >
                Revert to {baseNoun}
              </button>
            )}
            {dirty && <span className="text-osrs-parchment-dark/60 text-xs">Unsaved changes</span>}
          </div>
        </Card>

        {/* Preview + tokens */}
        <div className="space-y-4">
          <Card padding="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-osrs-gold text-sm font-semibold">Live preview</h3>
              <label className="text-osrs-parchment-dark/80 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={useSamples}
                  onChange={(e) => setUseSamples(e.target.checked)}
                  className="accent-osrs-gold"
                />
                Fill tokens with sample data
              </label>
            </div>
            <ComponentsPreview draft={draft} typeMeta={typeMeta} meta={meta} useSamples={useSamples} />
            <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
              Lines containing a token with no value are dropped when the real message is sent —
              use one token per line for clean fallbacks.
            </p>
          </Card>

          <Card padding="p-5">
            <h3 className="text-osrs-gold mb-2 text-sm font-semibold">
              Tokens for {typeMeta?.label.toLowerCase() ?? selected}
            </h3>
            <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
              Click a token to copy it, then paste it into any text, thumbnail, or button URL. It
              is replaced with live data when the message is sent.
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
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-event wrapper: fetches overrides + meta on mount so the big     */
/* event-discord surface only mounts a one-liner.                      */
/* ------------------------------------------------------------------ */
export function EventLayoutOverrides({
  groupId,
  eventId,
}: {
  groupId: number | null;
  eventId: number;
}) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; error: string }
    | { phase: "ready"; entries: LayoutEntry[]; meta: EventLayoutMeta }
  >({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [layoutsRes, metaRes] = await Promise.all([
          getEventLayoutsAction(groupId, eventId),
          getEventLayoutMetaAction(),
        ]);
        if (cancelled) return;
        if (!layoutsRes.ok) return setState({ phase: "error", error: layoutsRes.error });
        if (!metaRes.ok) return setState({ phase: "error", error: metaRes.error });
        setState({
          phase: "ready",
          entries: layoutsRes.data.layouts.map((l) => ({
            message_type: l.message_type,
            saved: l.override,
            base: l.effective,
          })),
          meta: metaRes.data,
        });
      } catch (err) {
        if (!cancelled) setState({ phase: "error", error: getErrorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, eventId]);

  if (state.phase === "loading")
    return <p className="text-osrs-parchment-dark/60 text-sm">Loading layouts…</p>;
  if (state.phase === "error") return <Alert variant="error">{state.error}</Alert>;
  return (
    <EventLayoutEditor
      scope={{ kind: "event", groupId, eventId }}
      entries={state.entries}
      meta={state.meta}
    />
  );
}
