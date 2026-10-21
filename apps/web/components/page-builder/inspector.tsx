"use client";

/**
 * Right-hand panel of the page builder (web137a): settings for the selected
 * block, or the page's style when nothing is selected. Every control edits
 * the layout in place; the builder autosaves and the preview follows.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BLOCK_SURFACES,
  GROUP_LINK_KEYS,
  GROUP_STATS,
  PLAYER_LINK_KEYS,
  PLAYER_STATS,
  type BlockSurface,
  type PageTheme,
} from "@droptracker/api-types";
import { BLOCK_DEF, SURFACE_LABELS } from "@/lib/page-layout/catalog";
import { Input, Textarea } from "@/components/ui";
import { PbBossSelect, type PbSelection } from "@/components/site-builder/pb-boss-select";
import { searchNpcs } from "@/lib/page-layout/builder-client";

export type Block = Record<string, unknown> & { id: string; type: string };

/* --- small controls ---------------------------------------------------------- */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-osrs-bronze/20 space-y-3 border-b px-4 py-4 last:border-0">
      <h3 className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-osrs-parchment mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="text-osrs-parchment-dark/55 mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="border-osrs-bronze/40 bg-osrs-surface-1 flex rounded-md border p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-osrs-gold text-osrs-brown-dark"
              : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-sm"
    >
      <span className="text-osrs-parchment">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-osrs-gold" : "bg-osrs-surface-3"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function NumberField({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      className="w-24"
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

/** Ordered on/off list (clan links, stats): toggle items and nudge their order. */
function KeyList({
  all,
  labels,
  value,
  onChange,
}: {
  all: readonly string[];
  labels: Record<string, string>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const ordered = [...value, ...all.filter((k) => !value.includes(k))];
  const move = (key: string, dir: -1 | 1) => {
    const i = value.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <ul className="space-y-1">
      {ordered.map((key) => {
        const on = value.includes(key);
        return (
          <li
            key={key}
            className={`border-osrs-bronze/30 flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${on ? "" : "opacity-55"}`}
          >
            <input
              type="checkbox"
              checked={on}
              className="accent-osrs-gold"
              onChange={() => onChange(on ? value.filter((k) => k !== key) : [...value, key])}
              aria-label={`Show ${labels[key] ?? key}`}
            />
            <span className="flex-1">{labels[key] ?? key}</span>
            {on && (
              <span className="flex gap-0.5">
                <button type="button" className="hover:text-osrs-gold-bright px-1" onClick={() => move(key, -1)} aria-label="Move up">
                  ↑
                </button>
                <button type="button" className="hover:text-osrs-gold-bright px-1" onClick={() => move(key, 1)} aria-label="Move down">
                  ↓
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NpcTypeahead({
  npcId,
  npcName,
  onChange,
}: {
  npcId: number | null;
  npcName: string;
  onChange: (id: number | null, name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      searchNpcs(query)
        .then((r) => mine === seq.current && setResults(r.slice(0, 8)))
        .catch(() => mine === seq.current && setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      {npcId ? (
        <div className="border-osrs-bronze/40 flex items-center gap-2 rounded border px-2 py-1.5 text-sm">
          <img src={`/img/npcdb/${npcId}.png`} alt="" className="size-5 object-contain" />
          <span className="flex-1">{npcName || `NPC #${npcId}`}</span>
          <button type="button" className="text-osrs-parchment-dark/70 hover:text-osrs-red text-xs" onClick={() => onChange(null, "")}>
            Change
          </button>
        </div>
      ) : (
        <>
          <Input placeholder="Search for a boss…" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && (
            <ul className="border-osrs-bronze/40 max-h-56 overflow-y-auto rounded border">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="hover:bg-osrs-bronze/25 flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      onChange(r.id, r.name);
                      setQ("");
                    }}
                  >
                    <img src={`/img/npcdb/${r.id}.png`} alt="" className="size-5 object-contain" />
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ButtonItems({
  items,
  onChange,
}: {
  items: { label: string; href: string }[];
  onChange: (next: { label: string; href: string }[]) => void;
}) {
  const set = (i: number, patch: Partial<{ label: string; href: string }>) =>
    onChange(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="border-osrs-bronze/30 space-y-1.5 rounded border p-2">
          <div className="flex gap-1.5">
            <Input placeholder="Label" value={it.label} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} />
            <button
              type="button"
              className="text-osrs-parchment-dark/60 hover:text-osrs-red px-1.5"
              onClick={() => onChange(items.filter((_, n) => n !== i))}
              aria-label="Remove button"
            >
              ✕
            </button>
          </div>
          <Input placeholder="https://…" value={it.href} maxLength={300} onChange={(e) => set(i, { href: e.target.value })} />
        </div>
      ))}
      {items.length < 8 && (
        <button
          type="button"
          className="border-osrs-bronze/50 hover:border-osrs-gold w-full rounded border border-dashed py-1.5 text-sm"
          onClick={() => onChange([...items, { label: "", href: "https://" }])}
        >
          + Add a button
        </button>
      )}
    </div>
  );
}

/* --- labels -------------------------------------------------------------------- */

const GROUP_LINK_LABELS: Record<string, string> = {
  lootboard: "Lootboard",
  clan_log: "Clan Log",
  personal_bests: "Personal bests",
  pvp: "PvP",
  points: "Points (when enabled)",
  recaps: "Recaps (once there is one)",
  events: "Events",
  discord: "Join Discord (when set)",
};
const PLAYER_LINK_LABELS: Record<string, string> = {
  collection_log: "Collection log",
  achievements: "Achievements",
  recap: "Monthly recap",
};
const GROUP_STAT_LABELS: Record<string, string> = {
  members: "Members",
  rank: "Global rank",
  monthly_loot: "Monthly loot",
  top_player: "Top player",
};
const PLAYER_STAT_LABELS: Record<string, string> = {
  monthly_loot: "Monthly loot",
  rank: "Global rank",
  clan_points: "Clan points",
  top_npc: "Top NPC",
};

const LINK_STYLE_OPTS = [
  { value: "outline", label: "Outline" },
  { value: "solid", label: "Solid" },
  { value: "osrs", label: "OSRS" },
] as const;
const ALIGN_OPTS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
] as const;
const PERIOD_OPTS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "all", label: "All time" },
] as const;

/** Blocks that are too dense to sit in a narrow column. */
const WIDE_ONLY = new Set(["records", "lootboard", "pb_board", "member_roster", "player_showcase", "personal_bests", "leaderboard"]);

/* --- block inspector ------------------------------------------------------------- */

function ContentFields({ block, set, groupId }: { block: Block; set: (patch: Record<string, unknown>) => void; groupId?: number }) {
  const str = (k: string) => (typeof block[k] === "string" ? (block[k] as string) : "");
  const num = (k: string, d: number) => (typeof block[k] === "number" ? (block[k] as number) : d);
  const how = (k = "limit", d = 10, min = 1, max = 25, label = "How many to show") => (
    <Row label={label}>
      <NumberField value={num(k, d)} min={min} max={max} onChange={(v) => set({ [k]: v })} />
    </Row>
  );
  switch (block.type) {
    case "markdown":
      return (
        <>
          <Row label="Text" hint="Markdown: ## for a heading, **bold**, - for a list, [link](https://…).">
            <Textarea rows={9} value={str("body")} maxLength={8000} onChange={(e) => set({ body: e.target.value })} />
          </Row>
          <Row label="Alignment">
            <Segmented value={(str("align") || "left") as "left"} options={[...ALIGN_OPTS]} onChange={(align) => set({ align })} />
          </Row>
        </>
      );
    case "image":
      return (
        <>
          <Row label="Image address" hint="A direct https:// link to a .png, .jpg or .gif.">
            <Input value={str("url")} placeholder="https://…" maxLength={300} onChange={(e) => set({ url: e.target.value || null })} />
          </Row>
          <Row label="Description" hint="Read out by screen readers.">
            <Input value={str("alt")} maxLength={200} onChange={(e) => set({ alt: e.target.value })} />
          </Row>
          <Row label="Caption">
            <Input value={str("caption")} maxLength={300} onChange={(e) => set({ caption: e.target.value })} />
          </Row>
          <Row label="Height">
            <Segmented
              value={(str("height") || "md") as "md"}
              options={[
                { value: "sm", label: "Short" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Tall" },
                { value: "auto", label: "Natural" },
              ]}
              onChange={(height) => set({ height })}
            />
          </Row>
          <Row label="Fit">
            <Segmented
              value={(str("fit") || "cover") as "cover"}
              options={[
                { value: "cover", label: "Fill" },
                { value: "contain", label: "Whole image" },
              ]}
              onChange={(fit) => set({ fit })}
            />
          </Row>
          <Row label="Link (optional)">
            <Input value={str("link")} placeholder="https://…" maxLength={300} onChange={(e) => set({ link: e.target.value || null })} />
          </Row>
        </>
      );
    case "buttons":
      return (
        <>
          <ButtonItems
            items={(block.items as { label: string; href: string }[]) ?? []}
            onChange={(items) => set({ items })}
          />
          <Row label="Style">
            <Segmented value={(str("style") || "solid") as "solid"} options={[...LINK_STYLE_OPTS]} onChange={(style) => set({ style })} />
          </Row>
          <Row label="Alignment">
            <Segmented value={(str("align") || "left") as "left"} options={[...ALIGN_OPTS]} onChange={(align) => set({ align })} />
          </Row>
        </>
      );
    case "divider":
      return (
        <>
          <Row label="Space">
            <Segmented
              value={(str("size") || "md") as "md"}
              options={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
              onChange={(size) => set({ size })}
            />
          </Row>
          <Toggle label="Draw a line" checked={block.rule !== false} onChange={(rule) => set({ rule })} />
        </>
      );
    case "group_links":
    case "player_links": {
      const isGroup = block.type === "group_links";
      return (
        <>
          <Row label="Links" hint="Links only appear when they apply (e.g. Discord once an invite is set).">
            <KeyList
              all={isGroup ? GROUP_LINK_KEYS : PLAYER_LINK_KEYS}
              labels={isGroup ? GROUP_LINK_LABELS : PLAYER_LINK_LABELS}
              value={(block.items as string[]) ?? []}
              onChange={(items) => set({ items })}
            />
          </Row>
          <Row label="Style">
            <Segmented value={(str("style") || "outline") as "outline"} options={[...LINK_STYLE_OPTS]} onChange={(style) => set({ style })} />
          </Row>
          <Row label="Alignment">
            <Segmented value={(str("align") || "left") as "left"} options={[...ALIGN_OPTS]} onChange={(align) => set({ align })} />
          </Row>
        </>
      );
    }
    case "stats_row":
    case "player_stats": {
      const isGroup = block.type === "stats_row";
      return (
        <Row label="Stats">
          <KeyList
            all={isGroup ? GROUP_STATS : PLAYER_STATS}
            labels={isGroup ? GROUP_STAT_LABELS : PLAYER_STAT_LABELS}
            value={(block.stats as string[]) ?? []}
            onChange={(stats) => set({ stats })}
          />
        </Row>
      );
    }
    case "records":
      return how("limit", 8, 1, 24, "Records to show");
    case "top_players":
    case "boss_activity":
    case "recent_drops":
    case "wom_achievements":
    case "top_bosses":
    case "player_recent_drops":
      return how();
    case "personal_bests":
      return how("limit", 12, 1, 60, "Shown before “Show all”");
    case "leaderboard":
      return how("limit", 10, 3, 50, "Players to show");
    case "announcements":
      return how("limit", 3, 1, 10, "Posts to show");
    case "lootboard":
      return (
        <Row label="Period">
          <Segmented value={(str("period") || "month") as "month"} options={[...PERIOD_OPTS]} onChange={(period) => set({ period })} />
        </Row>
      );
    case "recap":
      return (
        <Row label="Which recap">
          <Segmented
            value={(str("period") || "month") as "month"}
            options={[
              { value: "month", label: "Latest month" },
              { value: "year", label: "Latest year" },
            ]}
            onChange={(period) => set({ period })}
          />
        </Row>
      );
    case "pb_board":
      return groupId ? (
        <Row label="Bosses" hint="Pick up to 8. Leave empty to show your most contested boss.">
          <PbBossSelect
            groupId={groupId}
            value={(block.bosses as PbSelection[]) ?? []}
            onChange={(next) => set({ bosses: next.map((b) => ({ npc_id: b.npc_id, team_sizes: b.team_sizes })) })}
          />
        </Row>
      ) : null;
    case "npc_board":
      return (
        <>
          <Row label="Boss">
            <NpcTypeahead
              npcId={(block.npc_id as number | null) ?? null}
              npcName={str("npc_name")}
              onChange={(npc_id, npc_name) => set({ npc_id, npc_name })}
            />
          </Row>
          <Row label="Period">
            <Segmented value={(str("period") || "month") as "month"} options={[...PERIOD_OPTS]} onChange={(period) => set({ period })} />
          </Row>
          {how("limit", 10, 3, 50, "Players to show")}
        </>
      );
    case "event_standings":
      return (
        <Row label="Event" hint="Leave empty to follow whichever event is running.">
          <Input
            type="number"
            placeholder="Event id"
            value={block.event_id ? String(block.event_id) : ""}
            onChange={(e) => set({ event_id: Number(e.target.value) || null })}
          />
        </Row>
      );
    case "member_roster":
      return (
        <>
          {how("limit", 50, 5, 200, "Members to show")}
          <Row label="Order">
            <Segmented
              value={(str("sort") || "monthly") as "monthly"}
              options={[
                { value: "monthly", label: "This month" },
                { value: "all_time", label: "All time" },
                { value: "name", label: "A to Z" },
              ]}
              onChange={(sort) => set({ sort })}
            />
          </Row>
          <Row label="Layout">
            <Segmented
              value={(str("layout") || "cards") as "cards"}
              options={[
                { value: "cards", label: "Cards" },
                { value: "table", label: "Table" },
              ]}
              onChange={(layout) => set({ layout })}
            />
          </Row>
          <Toggle label="Show rank" checked={block.show_rank !== false} onChange={(show_rank) => set({ show_rank })} />
          <Toggle label="Visitors can re-sort" checked={block.sortable !== false} onChange={(sortable) => set({ sortable })} />
          <p className="text-osrs-parchment-dark/55 text-xs">
            Members who hide their profile are never listed.
          </p>
        </>
      );
    default:
      return <p className="text-osrs-parchment-dark/60 text-sm">This block has no settings of its own.</p>;
  }
}

function SurfacePicker({ value, onChange }: { value: BlockSurface; onChange: (s: BlockSurface) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {BLOCK_SURFACES.map((s) => (
        <button
          key={s}
          type="button"
          title={SURFACE_LABELS[s].hint}
          onClick={() => onChange(s)}
          className={`rounded-md border p-1 text-[11px] transition-colors ${
            value === s ? "border-osrs-gold" : "border-osrs-bronze/30 hover:border-osrs-gold/50"
          }`}
        >
          <span
            className={`mb-1 block h-8 w-full overflow-hidden rounded-sm ${
              s === "plain" ? "border border-dashed border-current/30" : s === "scroll" ? "" : `pl-surface-${s} !p-0`
            }`}
            style={s === "scroll" ? { background: "url(/scroll/backdrop_745.gif) center / cover" } : undefined}
          />
          {SURFACE_LABELS[s].label}
        </button>
      ))}
    </div>
  );
}

export function BlockInspector({
  block,
  onChange,
  onDuplicate,
  onDelete,
  onClose,
  groupId,
}: {
  block: Block;
  onChange: (patch: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  groupId?: number;
}) {
  const def = BLOCK_DEF[block.type];
  const wideOnly = WIDE_ONLY.has(block.type);
  return (
    <div>
      <div className="border-osrs-bronze/20 flex items-center gap-2 border-b px-4 py-3">
        <span className="text-lg leading-none">{def?.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-osrs-gold-bright truncate font-semibold">{def?.label ?? block.type}</div>
          <div className="text-osrs-parchment-dark/55 truncate text-xs">{def?.description}</div>
        </div>
        <button type="button" onClick={onClose} className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright px-1" aria-label="Back to page style">
          ✕
        </button>
      </div>
      <Section title="Content">
        <ContentFields block={block} set={onChange} groupId={groupId} />
      </Section>
      <Section title="Look">
        <Row label="Heading" hint="Optional title above the block.">
          <Input
            value={typeof block.title === "string" ? block.title : ""}
            maxLength={80}
            placeholder="No heading"
            onChange={(e) => onChange({ title: e.target.value || null })}
          />
        </Row>
        <Row label="Width" hint={wideOnly ? "This block needs room, so it stays wide." : "Side-by-side on desktop; phones always stack."}>
          <Segmented
            value={(block.width as "full") ?? "full"}
            options={
              wideOnly
                ? [
                    { value: "full", label: "Full" },
                    { value: "two_thirds", label: "⅔" },
                  ]
                : [
                    { value: "full", label: "Full" },
                    { value: "two_thirds", label: "⅔" },
                    { value: "half", label: "½" },
                    { value: "third", label: "⅓" },
                  ]
            }
            onChange={(width) => onChange({ width })}
          />
        </Row>
        <Row label="Background">
          <SurfacePicker value={(block.surface as BlockSurface) ?? "plain"} onChange={(surface) => onChange({ surface })} />
        </Row>
        <Row label="Show on">
          <Segmented
            value={(block.hide_on as "none") ?? "none"}
            options={[
              { value: "none", label: "Everywhere" },
              { value: "mobile", label: "Desktop only", title: "Hidden on phones" },
              { value: "desktop", label: "Phone only", title: "Hidden on desktop" },
            ]}
            onChange={(hide_on) => onChange({ hide_on })}
          />
        </Row>
      </Section>
      <div className="flex gap-2 px-4 py-4">
        <button type="button" onClick={onDuplicate} className="border-osrs-bronze/50 hover:bg-osrs-bronze/25 flex-1 rounded border py-1.5 text-sm">
          Duplicate
        </button>
        <button type="button" onClick={onDelete} className="border-osrs-red/50 text-osrs-red hover:bg-osrs-red/15 flex-1 rounded border py-1.5 text-sm">
          Delete
        </button>
      </div>
    </div>
  );
}

/* --- page style ------------------------------------------------------------------------ */

const PRESETS: { value: PageTheme["preset"]; label: string; swatch: string[] }[] = [
  { value: "default", label: "Site default", swatch: ["#15110c", "#ffb83f", "#7a5a32"] },
  { value: "dusk", label: "Dusk", swatch: ["#15110c", "#ffb83f", "#7a5a32"] },
  { value: "parchment", label: "Parchment", swatch: ["#ece0c6", "#8a5f04", "#a07b42"] },
  { value: "wilderness", label: "Wilderness", swatch: ["#0b0b0d", "#ff8a45", "#7a4a3a"] },
];

const BACKGROUNDS: { value: PageTheme["background"]; label: string; cls: string }[] = [
  { value: "default", label: "None", cls: "border border-dashed border-current/30" },
  { value: "plain", label: "Panel", cls: "pl-bg-plain !p-0" },
  { value: "stone", label: "Stone", cls: "pl-bg-stone !p-0" },
  { value: "parchment", label: "Parchment", cls: "pl-bg-parchment !p-0" },
  { value: "starry", label: "Night sky", cls: "pl-bg-starry !p-0" },
];

const COLOUR_KEYS: { key: string; label: string }[] = [
  { key: "--dt-gold", label: "Accent" },
  { key: "--dt-gold-bright", label: "Highlight" },
  { key: "--dt-bronze", label: "Borders and buttons" },
  { key: "--dt-text", label: "Text" },
];

export function PageInspector({
  theme,
  onChange,
  kind,
}: {
  theme: PageTheme;
  onChange: (patch: Partial<PageTheme>) => void;
  kind: "group" | "player";
}) {
  const palette = theme.palette ?? {};
  const setColour = (key: string, value: string | null) => {
    const next = { ...palette };
    if (value) next[key] = value;
    else delete next[key];
    onChange({ palette: next });
  };
  return (
    <div>
      <div className="border-osrs-bronze/20 border-b px-4 py-3">
        <div className="text-osrs-gold-bright font-semibold">Page style</div>
        <div className="text-osrs-parchment-dark/55 text-xs">Click a block in the preview to edit it.</div>
      </div>
      <Section title="Header">
        <Row label="Layout">
          <Segmented
            value={theme.header_style}
            options={[
              { value: "standard", label: "Standard" },
              { value: "centered", label: "Centred" },
              { value: "banner", label: "Banner" },
            ]}
            onChange={(header_style) => onChange({ header_style })}
          />
        </Row>
        {theme.header_style === "banner" && (
          <>
            <Row label="Banner image" hint="https:// link to a wide image. Leave empty for a plain gradient.">
              <Input
                value={theme.banner_url ?? ""}
                placeholder="https://…"
                maxLength={300}
                onChange={(e) => onChange({ banner_url: e.target.value || null })}
              />
            </Row>
            <Row label="Banner height">
              <Segmented
                value={theme.banner_height}
                options={[
                  { value: "sm", label: "Short" },
                  { value: "md", label: "Medium" },
                  { value: "lg", label: "Tall" },
                ]}
                onChange={(banner_height) => onChange({ banner_height })}
              />
            </Row>
          </>
        )}
        <Toggle
          label={kind === "group" ? "Show the group description" : "Show the subtitle"}
          checked={theme.show_description}
          onChange={(show_description) => onChange({ show_description })}
        />
      </Section>
      <Section title="Colours">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ preset: p.value })}
              className={`rounded-md border p-2 text-left text-xs transition-colors ${
                theme.preset === p.value ? "border-osrs-gold" : "border-osrs-bronze/30 hover:border-osrs-gold/50"
              }`}
            >
              <span className="mb-1.5 flex gap-1">
                {p.swatch.map((c) => (
                  <span key={c} className="size-4 rounded-full border border-black/40" style={{ background: c }} />
                ))}
              </span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5 pt-1">
          {COLOUR_KEYS.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                aria-label={c.label}
                value={palette[c.key] ?? "#ffb83f"}
                onChange={(e) => setColour(c.key, e.target.value)}
                className={`size-7 cursor-pointer rounded border-0 bg-transparent p-0 ${palette[c.key] ? "" : "opacity-40"}`}
              />
              <span className="flex-1">{c.label}</span>
              {palette[c.key] ? (
                <button type="button" className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs" onClick={() => setColour(c.key, null)}>
                  Reset
                </button>
              ) : (
                <span className="text-osrs-parchment-dark/45 text-xs">Theme</span>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Background">
        <div className="grid grid-cols-3 gap-1.5">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => onChange({ background: b.value })}
              className={`rounded-md border p-1 text-[11px] transition-colors ${
                theme.background === b.value ? "border-osrs-gold" : "border-osrs-bronze/30 hover:border-osrs-gold/50"
              }`}
            >
              <span className={`mb-1 block h-8 w-full rounded-sm ${b.cls}`} />
              {b.label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

