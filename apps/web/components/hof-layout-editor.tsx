"use client";

/**
 * Hall of Fame layout builder — how each boss message in a group's Hall of
 * Fame channel is laid out (backend services/hof_layout.py).
 *
 * Same block DSL as the notification builder (notification-layout-editor.tsx)
 * plus two things only a Hall of Fame needs:
 *
 * - a **Leaderboard** block: pick what it ranks (personal bests, kill count,
 *   loot this month, loot all time), how many places, and how each line looks;
 * - **Repeat for each raid mode** on any block: raids share one message, and a
 *   repeating block is drawn once per mode with that mode's numbers.
 *
 * Tokens and emoji are inserted at the cursor of whichever box was last
 * clicked, so nobody has to remember `{top_looter_month}` or an emoji name.
 *
 * The preview is rendered by the backend with the group's real standings for
 * one of its bosses (the same renderer the bot uses), because the questions
 * that matter — does a line vanish for a boss nobody has looted, does a raid
 * with three modes still fit — cannot be answered from sample values.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  GroupHofLayoutResponse,
  HofLayout,
  HofLayoutBlock,
  HofLayoutInput,
  HofLayoutMeta,
  HofLayoutPreview,
  HofLeaderboardBoard,
  HofRenderedComponent,
} from "@droptracker/api-types";
import {
  previewHofLayoutAction,
  resetHofLayoutAction,
  saveHofLayoutAction,
} from "@/app/(site)/(admin)/groups/[id]/hall-of-fame/actions";
import { getErrorMessage } from "@/lib/errors";
import { DiscordMessageFrame, HiddenOnError, PreviewLines } from "@/components/components-v2-preview";
import { Alert, Card, fieldInputClass } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Draft model                                                          */
/* ------------------------------------------------------------------ */
type BlockType = HofLayoutBlock["type"];
type TextField = "content" | "thumbnail" | "title" | "line" | "bracket" | "empty";
type BlockDraft = {
  type: BlockType;
  eachMode: boolean;
  content: string;
  thumbnail: string;
  divider: boolean;
  largeGap: boolean;
  urls: string[];
  buttons: { label: string; url: string }[];
  board: HofLeaderboardBoard;
  /** null = the group's "Number of PBs to display" setting. */
  count: number | null;
  title: string;
  line: string;
  bracket: string;
  empty: string;
};
type Draft = { accent: string; blocks: BlockDraft[] };

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Text",
  section: "Text + picture",
  leaderboard: "Leaderboard",
  separator: "Divider",
  media: "Images",
  buttons: "Link buttons",
};
const ADDABLE: BlockType[] = ["text", "section", "leaderboard", "separator", "buttons", "media"];

function blankBlock(type: BlockType): BlockDraft {
  return {
    type,
    eachMode: false,
    content: "",
    thumbnail: type === "section" ? "{boss_image_url}" : "",
    divider: true,
    largeGap: false,
    urls: type === "media" ? [""] : [],
    buttons: type === "buttons" ? [{ label: "View on DropTracker", url: "{boss_url}" }] : [],
    board: "kc",
    count: 3,
    title: type === "leaderboard" ? "**Highest kill counts**" : "",
    line: "",
    bracket: "",
    empty: "",
  };
}

function blockDraft(block: HofLayoutBlock): BlockDraft {
  const base = blankBlock(block.type);
  const eachMode = Boolean(block.each_mode);
  switch (block.type) {
    case "text":
      return { ...base, eachMode, content: block.content };
    case "section":
      return { ...base, eachMode, content: block.content, thumbnail: block.thumbnail ?? "" };
    case "separator":
      return {
        ...base,
        eachMode,
        divider: block.divider ?? true,
        largeGap: block.spacing === "large",
      };
    case "media":
      return { ...base, eachMode, urls: [...block.urls] };
    case "buttons":
      return { ...base, eachMode, buttons: block.buttons.map((b) => ({ ...b })) };
    case "leaderboard":
      return {
        ...base,
        eachMode,
        board: block.board,
        count: block.count ?? null,
        title: block.title ?? "",
        line: block.line ?? "",
        bracket: block.bracket ?? "",
        empty: block.empty ?? "",
      };
  }
}

function draftFrom(layout: HofLayout | null | undefined): Draft {
  if (!layout) return { accent: "", blocks: [] };
  return { accent: layout.accent_color ?? "", blocks: layout.blocks.map(blockDraft) };
}

function toInput(draft: Draft, active: boolean): HofLayoutInput {
  const blocks: HofLayoutBlock[] = draft.blocks.map((b) => {
    const each = b.eachMode ? { each_mode: true } : {};
    switch (b.type) {
      case "text":
        return { type: "text", content: b.content, ...each };
      case "section":
        return { type: "section", content: b.content, thumbnail: b.thumbnail.trim() || null, ...each };
      case "separator":
        return { type: "separator", divider: b.divider, spacing: b.largeGap ? "large" : "small", ...each };
      case "media":
        return { type: "media", urls: b.urls.map((u) => u.trim()).filter(Boolean), ...each };
      case "buttons":
        return {
          type: "buttons",
          buttons: b.buttons
            .filter((x) => x.label.trim())
            .map((x) => ({ label: x.label.trim(), url: x.url.trim() })),
          ...each,
        };
      case "leaderboard":
        return {
          type: "leaderboard",
          board: b.board,
          count: b.count,
          title: b.title || null,
          line: b.line || null,
          bracket: b.board === "pb" ? b.bracket || null : null,
          empty: b.empty || null,
          ...each,
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
/* Preview (server-rendered)                                            */
/* ------------------------------------------------------------------ */
function RenderedComponents({ items }: { items: HofRenderedComponent[] }) {
  return (
    <>
      {items.map((c, i) => {
        if (c.type === 14)
          return (
            <hr
              key={i}
              className={`${c.spacing === 2 ? "my-4" : "my-2"} ${
                c.divider === false ? "border-transparent" : "border-[#3f4147]"
              }`}
            />
          );
        if (c.type === 10)
          return (
            <div key={i} className="space-y-0.5">
              <PreviewLines text={c.content ?? ""} keyPrefix={`c${i}`} />
            </div>
          );
        if (c.type === 9) {
          const text = c.components?.[0]?.content ?? "";
          const thumb = c.accessory?.media?.url;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="min-w-0 grow space-y-0.5">
                <PreviewLines text={text} keyPrefix={`c${i}`} />
              </div>
              {thumb && (
                <HiddenOnError src={thumb} className="h-16 w-16 shrink-0 rounded object-contain" />
              )}
            </div>
          );
        }
        if (c.type === 12)
          return (
            <div key={i} className={(c.items?.length ?? 0) > 1 ? "grid grid-cols-2 gap-1" : "block"}>
              {(c.items ?? []).map((it, j) => (
                <HiddenOnError key={j} src={it.media.url} className="max-h-56 w-full rounded object-cover" />
              ))}
            </div>
          );
        if (c.type === 1)
          return (
            <div key={i} className="flex flex-wrap gap-2 pt-1">
              {(c.components ?? []).map((b, j) => (
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
        return null;
      })}
    </>
  );
}

function hexAccent(value: number | undefined): string {
  return value === undefined ? "#1e1f22" : `#${value.toString(16).padStart(6, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Insert palette (tokens + emoji)                                      */
/* ------------------------------------------------------------------ */
function EmojiPicker({
  emojis,
  onPick,
}: {
  emojis: HofLayoutMeta["emojis"];
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"npc" | "item">("npc");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return emojis
      .filter((e) => e.kind === kind && (!q || e.label.toLowerCase().includes(q)))
      .slice(0, 120);
  }, [emojis, query, kind]);

  if (!emojis.length)
    return (
      <p className="text-osrs-parchment-dark/60 text-xs">
        The bot&apos;s boss and item icons are unavailable right now.
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons, e.g. Zulrah or Twisted bow"
          className={`${fieldInputClass} min-w-0 grow`}
        />
        <div className="border-osrs-bronze/30 inline-flex gap-1 rounded border p-0.5">
          {(["npc", "item"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded px-2 py-1 text-xs ${
                kind === k
                  ? "bg-osrs-bronze text-osrs-parchment"
                  : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
              }`}
            >
              {k === "npc" ? "Bosses & NPCs" : "Items"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-10">
        {shown.map((e) => (
          <button
            key={e.name}
            type="button"
            title={e.label}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e.name)}
            className="hover:bg-osrs-bronze/30 flex aspect-square items-center justify-center rounded"
          >
            <img
              src={`https://cdn.discordapp.com/emojis/${e.id}.webp?size=48`}
              alt={e.label}
              loading="lazy"
              className="h-7 w-7 object-contain"
            />
          </button>
        ))}
        {!shown.length && (
          <p className="text-osrs-parchment-dark/60 col-span-full text-xs">No icons match.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block form                                                           */
/* ------------------------------------------------------------------ */
type FieldRef = { index: number; field: TextField };

function BlockForm({
  block,
  index,
  count,
  meta,
  onChange,
  onMove,
  onRemove,
  onFocusField,
  registerField,
}: {
  block: BlockDraft;
  index: number;
  count: number;
  meta: HofLayoutMeta;
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onFocusField: (field: TextField) => void;
  registerField: (field: TextField, el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const boardMeta = meta.boards.find((b) => b.key === block.board);
  const maxRows = meta.limits.max_rows ?? 10;
  const textProps = (field: TextField) => ({
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => registerField(field, el),
    onFocus: () => onFocusField(field),
    value: block[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [field]: e.target.value } as Partial<BlockDraft>),
  });

  return (
    <div
      className={`rounded border p-2 ${
        block.eachMode ? "border-osrs-gold/50 bg-osrs-gold/5" : "border-osrs-bronze/25"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-osrs-gold-bright text-xs font-semibold">{BLOCK_LABELS[block.type]}</span>
        <label
          className="text-osrs-parchment-dark/80 flex items-center gap-1 text-xs"
          title="Raids share one message. A repeating block is drawn once for each mode (Normal, Challenge Mode, ...) with that mode's numbers. For other bosses it is drawn once."
        >
          <input
            type="checkbox"
            checked={block.eachMode}
            onChange={(e) => onChange({ eachMode: e.target.checked })}
            className="accent-osrs-gold"
          />
          Repeat for each raid mode
        </label>
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
            {...textProps("content")}
            maxLength={meta.limits.max_text_len ?? 3500}
            rows={block.type === "section" ? 5 : 2}
            className={`${fieldInputClass} w-full font-mono text-xs`}
            placeholder={"## {boss_emoji} {boss_link}\n-# Highest KC: `{top_kc}` by {top_kc_player}"}
          />
          {block.type === "section" && (
            <input
              {...textProps("thumbnail")}
              type="text"
              maxLength={500}
              className={`${fieldInputClass} mt-2 w-full`}
              placeholder="Picture beside the text: {boss_image_url} or an image link"
            />
          )}
        </>
      )}

      {block.type === "leaderboard" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={block.board}
              onChange={(e) => onChange({ board: e.target.value as HofLeaderboardBoard })}
              className={`${fieldInputClass} w-auto`}
              aria-label="What this leaderboard ranks"
            >
              {meta.boards.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            <label className="text-osrs-parchment-dark/80 flex items-center gap-1 text-xs">
              Show top
              <input
                type="number"
                min={1}
                max={maxRows}
                value={block.count ?? ""}
                placeholder="—"
                disabled={block.count === null}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({ count: Number.isFinite(n) ? Math.max(1, Math.min(maxRows, n)) : 1 });
                }}
                className={`${fieldInputClass} w-16`}
              />
            </label>
            {block.board === "pb" && (
              <label className="text-osrs-parchment-dark/80 flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={block.count === null}
                  onChange={(e) => onChange({ count: e.target.checked ? null : 5 })}
                  className="accent-osrs-gold"
                />
                Use my &ldquo;Number of PBs to display&rdquo; setting
              </label>
            )}
          </div>
          <p className="text-osrs-parchment-dark/60 text-xs">
            {boardMeta?.help}
            {block.board === "pb" && " Each team size gets its own list."}
          </p>
          <input
            {...textProps("title")}
            type="text"
            maxLength={500}
            className={`${fieldInputClass} w-full`}
            placeholder="Heading (optional), e.g. **Most kills**"
          />
          {block.board === "pb" && (
            <textarea
              {...textProps("bracket")}
              rows={2}
              maxLength={500}
              className={`${fieldInputClass} w-full font-mono text-xs`}
              placeholder={`Above each team size: ${meta.default_bracket}`}
            />
          )}
          <input
            {...textProps("line")}
            type="text"
            maxLength={500}
            className={`${fieldInputClass} w-full font-mono text-xs`}
            placeholder={`Each place: ${boardMeta?.default_line ?? "{medal} {player} {value}"}`}
          />
          <input
            {...textProps("empty")}
            type="text"
            maxLength={500}
            className={`${fieldInputClass} w-full`}
            placeholder="When nobody is ranked yet (optional — blank hides the block)"
          />
          <p className="text-osrs-parchment-dark/50 text-xs">
            In a line: {meta.row_tokens.map((t) => `{${t.token}}`).join(" ")}. {"{value}"} is{" "}
            {boardMeta?.value}.
          </p>
        </div>
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
                placeholder="https://… or {boss_image_url}"
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
            disabled={block.urls.length >= (meta.limits.max_media_items ?? 10)}
            onClick={() => onChange({ urls: [...block.urls, ""] })}
            className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs disabled:opacity-40"
          >
            + Add image
          </button>
        </div>
      )}

      {block.type === "buttons" && (
        <div className="space-y-2">
          {block.buttons.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={b.label}
                maxLength={meta.limits.max_label_len ?? 80}
                onChange={(e) =>
                  onChange({
                    buttons: block.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  })
                }
                className={`${fieldInputClass} w-32 grow`}
                placeholder="Label"
              />
              <input
                type="text"
                value={b.url}
                maxLength={500}
                onChange={(e) =>
                  onChange({
                    buttons: block.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  })
                }
                className={`${fieldInputClass} w-40 grow-[2]`}
                placeholder="https://… or {boss_url}"
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
            disabled={block.buttons.length >= (meta.limits.max_buttons ?? 5)}
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
export function HofLayoutEditor({
  groupId,
  initial,
  meta,
}: {
  groupId: number;
  initial: GroupHofLayoutResponse;
  meta: HofLayoutMeta;
}) {
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial.custom ?? initial.default));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [boss, setBoss] = useState<string | null>(initial.bosses[0] ?? null);
  const [preview, setPreview] = useState<HofLayoutPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [paletteTab, setPaletteTab] = useState<"tokens" | "emoji">("tokens");

  const hasSaved = Boolean(state.custom);
  const isLive = state.active;
  const maxBlocks = meta.limits.max_blocks ?? 30;

  /* -- cursor-aware insertion ---------------------------------------- */
  const fields = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  const [focused, setFocused] = useState<FieldRef | null>(null);
  const fieldKey = (f: FieldRef) => `${f.index}:${f.field}`;

  const update = (mutate: (d: Draft) => Draft) => {
    setDraft(mutate);
    setDirty(true);
  };
  const updateBlock = (i: number, patch: Partial<BlockDraft>) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const insert = (snippet: string) => {
    // Fall back to the last text block when nothing has been clicked yet.
    let target = focused;
    if (!target) {
      const idx = draft.blocks.map((b) => b.type).lastIndexOf("section");
      const alt = draft.blocks.map((b) => b.type).lastIndexOf("text");
      const pick = idx >= 0 ? idx : alt;
      if (pick < 0) {
        setMessage({ tone: "error", text: "Add a text block, then click where the token should go." });
        return;
      }
      target = { index: pick, field: "content" };
    }
    const block = draft.blocks[target.index];
    if (!block) return;
    const el = fields.current.get(fieldKey(target));
    const value = block[target.field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    updateBlock(target.index, { [target.field]: next } as Partial<BlockDraft>);
    const caret = start + snippet.length;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  /* -- live preview ---------------------------------------------------- */
  const previewSeq = useRef(0);
  useEffect(() => {
    if (!draft.blocks.length) {
      setPreview(null);
      return;
    }
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await previewHofLayoutAction(groupId, toInput(draft, false), boss);
        if (seq !== previewSeq.current) return;
        if (res.ok) {
          setPreview(res.data);
          setPreviewError(null);
        } else setPreviewError(res.error);
      } catch (err) {
        if (seq === previewSeq.current) setPreviewError(getErrorMessage(err));
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, boss, groupId]);

  /* -- persistence ----------------------------------------------------- */
  const persist = (active: boolean, successText: string) => {
    if (!draft.blocks.length) {
      setMessage({ tone: "error", text: "The layout needs at least one block." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveHofLayoutAction(groupId, toInput(draft, active));
        if (!res.ok) {
          setMessage({ tone: "error", text: res.error });
          return;
        }
        setState((s) => ({ ...s, custom: res.data.layout, active: res.data.active }));
        setDraft(draftFrom(res.data.layout));
        setDirty(false);
        setMessage({ tone: "success", text: successText });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const save = () =>
    persist(
      isLive,
      isLive
        ? "Saved. Your Hall of Fame channel updates within about 10 minutes."
        : "Saved as a draft. Your channel still uses the default layout.",
    );
  const goLive = () => {
    if (
      !window.confirm(
        "Rebuild every boss message in your Hall of Fame channel with this layout? " +
          "You can switch back to the default at any time.",
      )
    )
      return;
    persist(true, "Switched over. Your Hall of Fame channel updates within about 10 minutes.");
  };
  const goDefault = () =>
    persist(false, "Switched back to the default layout. Your layout is kept as a draft.");

  const revert = () => {
    if (!window.confirm("Delete your layout and go back to the default?")) return;
    startTransition(async () => {
      const res = await resetHofLayoutAction(groupId);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error });
        return;
      }
      setState((s) => ({ ...s, custom: null, active: false }));
      setDraft(draftFrom(state.default));
      setDirty(false);
      setMessage({ tone: "success", text: "Deleted. Your channel uses the default layout." });
    });
  };

  const startFromDefault = () => {
    if (dirty && !window.confirm("Replace your unsaved changes with the default layout?")) return;
    update(() => draftFrom(state.default));
  };

  const payload = preview && preview.ok ? preview.payload : null;
  const container = payload?.components[0];

  return (
    <div className="space-y-4">
      <p className="text-osrs-parchment-dark/70 text-sm">
        {isLive
          ? "Your Hall of Fame channel is built from your layout."
          : hasSaved
            ? "Your channel uses the default layout. The layout saved here is a draft."
            : "Your channel uses the default layout. Change the blocks below to make it your own."}
      </p>
      {!state.emoji_supported && (
        <Alert variant="info">
          Boss and item icons only appear once the main DropTracker bot posts your Hall of Fame.
          If the separate &ldquo;DropTracker Hall of Fame&rdquo; bot is still in your server,
          remove it (see Settings → Personal bests &amp; Hall of Fame). Until then icons are left
          out and everything else still shows.
        </Alert>
      )}
      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Blocks */}
        <Card padding="p-5" className="min-w-0 space-y-4">
          <div>
            <label className="text-osrs-parchment mb-1 block text-sm font-medium">Accent color</label>
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
                    onClick={() => update((d) => ({ ...d, blocks: [...d.blocks, blankBlock(t)] }))}
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
                  meta={meta}
                  onChange={(patch) => updateBlock(i, patch)}
                  onMove={(dir) =>
                    update((d) => {
                      const blocks = [...d.blocks];
                      const a = blocks[i];
                      const c = blocks[i + dir];
                      if (a === undefined || c === undefined) return d;
                      blocks[i] = c;
                      blocks[i + dir] = a;
                      return { ...d, blocks };
                    })
                  }
                  onRemove={() => {
                    setFocused(null);
                    update((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }));
                  }}
                  onFocusField={(field) => setFocused({ index: i, field })}
                  registerField={(field, el) => {
                    const key = fieldKey({ index: i, field });
                    if (el) fields.current.set(key, el);
                    else fields.current.delete(key);
                  }}
                />
              ))}
              {draft.blocks.length === 0 && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  No blocks yet. Add a text block, or{" "}
                  <button type="button" onClick={startFromDefault} className="text-osrs-gold-bright underline">
                    start from the default
                  </button>
                  .
                </p>
              )}
            </div>
          </div>

          <div className="border-osrs-bronze/25 space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={pending || !dirty}
                className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {pending ? "Saving…" : isLive ? "Save" : "Save draft"}
              </button>
              {!isLive ? (
                <button
                  type="button"
                  onClick={goLive}
                  disabled={pending || !draft.blocks.length || !state.enabled}
                  className="border-osrs-gold/60 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Use this layout in my channel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goDefault}
                  disabled={pending}
                  className="text-osrs-parchment-dark/80 hover:text-osrs-parchment px-2 py-2 text-sm disabled:opacity-50"
                >
                  Switch back to the default
                </button>
              )}
              <button
                type="button"
                onClick={startFromDefault}
                disabled={pending}
                className="text-osrs-parchment-dark/70 hover:text-osrs-parchment px-2 py-2 text-sm disabled:opacity-50"
              >
                Start over from the default
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

        {/* Preview + palette */}
        <div className="min-w-0 space-y-4">
          <Card padding="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-osrs-gold text-sm font-semibold">
                Live preview {previewing && <span className="text-osrs-parchment-dark/50 text-xs">updating…</span>}
              </h3>
              {state.bosses.length > 0 && (
                <select
                  value={boss ?? ""}
                  onChange={(e) => setBoss(e.target.value || null)}
                  className={`${fieldInputClass} w-auto max-w-[14rem]`}
                  aria-label="Boss to preview"
                >
                  {state.bosses.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {previewError && <Alert variant="error">{previewError}</Alert>}
            {preview && !preview.ok && (
              <Alert variant="error">
                <ul className="list-disc pl-4">
                  {preview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {preview && preview.ok && preview.message && <Alert variant="info">{preview.message}</Alert>}
            {preview && preview.ok && preview.used_default && (
              <Alert variant="info">
                This layout doesn&apos;t fit Discord&apos;s size limit for {preview.boss}, even with
                shorter leaderboards, so that boss would get the default layout. Try fewer places
                or less text.
              </Alert>
            )}
            {container ? (
              <DiscordMessageFrame accent={hexAccent(container.accent_color)}>
                <RenderedComponents items={container.components ?? []} />
              </DiscordMessageFrame>
            ) : (
              !previewError &&
              !(preview && !preview.ok) && (
                <DiscordMessageFrame accent="#1e1f22">
                  <div className="text-sm italic text-[#949ba4]">
                    {draft.blocks.length ? "Rendering…" : "Add blocks to build this message."}
                  </div>
                </DiscordMessageFrame>
              )
            )}
            <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
              Drawn with your members&apos; real standings, exactly as the bot would post it. A line
              whose value is missing for this boss (nobody has looted it yet, say) is left out.
            </p>
          </Card>

          <Card padding="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-osrs-gold text-sm font-semibold">Insert</h3>
              <div className="border-osrs-bronze/30 inline-flex gap-1 rounded border p-0.5">
                {(["tokens", "emoji"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPaletteTab(t)}
                    className={`rounded px-2 py-1 text-xs ${
                      paletteTab === t
                        ? "bg-osrs-bronze text-osrs-parchment"
                        : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
                    }`}
                  >
                    {t === "tokens" ? "Values" : "Icons"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
              Click into a box on the left, then pick something here to insert it at the cursor.
            </p>
            {paletteTab === "tokens" ? (
              <div className="space-y-3">
                {meta.token_groups.map((g) => (
                  <div key={g.label}>
                    <div className="text-osrs-parchment-dark/50 mb-1 text-[11px] tracking-wide uppercase">
                      {g.label}
                    </div>
                    <div className="space-y-0.5">
                      {g.tokens.map((d) => (
                        <button
                          key={d.token}
                          type="button"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => insert(`{${d.token}}`)}
                          className="hover:bg-osrs-bronze/20 flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left"
                        >
                          <code className="text-osrs-gold-bright shrink-0 text-xs">{`{${d.token}}`}</code>
                          <span className="text-osrs-parchment-dark/70 truncate text-xs">{d.help}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-osrs-parchment-dark/50 mb-1 text-[11px] tracking-wide uppercase">
                    Leaderboard lines
                  </div>
                  <div className="space-y-0.5">
                    {meta.row_tokens.map((d) => (
                      <button
                        key={d.token}
                        type="button"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => insert(`{${d.token}}`)}
                        className="hover:bg-osrs-bronze/20 flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left"
                      >
                        <code className="text-osrs-gold-bright shrink-0 text-xs">{`{${d.token}}`}</code>
                        <span className="text-osrs-parchment-dark/70 truncate text-xs">{d.help}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { token: "{boss_emoji}", label: "This boss's icon" },
                    { token: "{coins_emoji}", label: "Coins" },
                  ].map((q) => (
                    <button
                      key={q.token}
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => insert(q.token)}
                      className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs"
                    >
                      {q.label} <code className="text-osrs-gold-bright">{q.token}</code>
                    </button>
                  ))}
                </div>
                <p className="text-osrs-parchment-dark/60 text-xs">
                  Or place any of the bot&apos;s own icons. Ordinary emoji can be typed or pasted
                  straight into the text.
                </p>
                <EmojiPicker emojis={meta.emojis} onPick={(name) => insert(`{emoji:${name}}`)} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
