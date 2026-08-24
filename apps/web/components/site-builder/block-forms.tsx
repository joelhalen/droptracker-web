"use client";

/**
 * Block catalog + per-type settings forms for the site builder (sites-v1).
 * Extracted from site-builder.tsx when the drag-and-drop editor landed so the
 * canvas, palette panel and settings inspector can share one source of truth.
 */
import { fieldInputClass, Input, Select, Textarea } from "@/components/ui";
import { QuantityInput } from "@/components/quantity-input";
import { SITE_TOKENS } from "@/lib/site-tokens";
import { PbBossSelect } from "./pb-boss-select";

export type Block = Record<string, unknown>;

/** The `<Input>` look for the numeric fields, which go through
 * `<QuantityInput>` (a raw input) so an emptied box stays empty while it is
 * being retyped instead of snapping back to a number. */
const numField = `${fieldInputClass} w-24`;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-osrs-parchment-dark/80 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

/** Catalog for the palette panel: label, one-line description, glyph. */
export const BLOCK_CATALOG: Array<{
  type: string;
  label: string;
  icon: string;
  description: string;
  make: () => Block;
}> = [
  { type: "hero", label: "Hero", icon: "✦", description: "Big heading, tagline and clan image.", make: () => ({ type: "hero", heading: "Our clan" }) },
  { type: "markdown", label: "Text", icon: "¶", description: "Free-form text with Markdown formatting.", make: () => ({ type: "markdown", body: "Write something…" }) },
  { type: "stats_row", label: "Stat tiles", icon: "▦", description: "Members, monthly loot, rank at a glance.", make: () => ({ type: "stats_row", stats: ["members", "monthly_loot", "rank"] }) },
  { type: "top_players", label: "Top players", icon: "♛", description: "Your biggest earners this month.", make: () => ({ type: "top_players", period: "month", limit: 10 }) },
  { type: "records", label: "Clan records", icon: "⏱", description: "Fastest kill times and their holders.", make: () => ({ type: "records" }) },
  { type: "boss_activity", label: "Boss activity", icon: "⚔", description: "Your most-farmed bosses.", make: () => ({ type: "boss_activity", limit: 8 }) },
  { type: "recent_drops", label: "Recent drops", icon: "◈", description: "Latest tracked drops and achievements.", make: () => ({ type: "recent_drops", limit: 10 }) },
  { type: "lootboard", label: "Lootboard", icon: "▤", description: "The full monthly lootboard canvas.", make: () => ({ type: "lootboard", period: "month" }) },
  { type: "leaderboard", label: "Leaderboard", icon: "☰", description: "Live monthly GP leaderboard.", make: () => ({ type: "leaderboard", limit: 10 }) },
  { type: "pb_board", label: "PB board", icon: "⏲", description: "Personal-best times for a boss.", make: () => ({ type: "pb_board" }) },
  { type: "npc_board", label: "Boss board", icon: "🐉", description: "Per-boss loot rankings.", make: () => ({ type: "npc_board", npc_id: 0, period: "month", limit: 10 }) },
  { type: "wom_achievements", label: "Achievements", icon: "🏆", description: "Recent Wise Old Man milestones.", make: () => ({ type: "wom_achievements", limit: 10 }) },
  { type: "member_roster", label: "Member roster", icon: "👥", description: "Your public member list (opt-in).", make: () => ({ type: "member_roster", limit: 25 }) },
  { type: "event_standings", label: "Event standings", icon: "🚩", description: "Team scores for a running event.", make: () => ({ type: "event_standings" }) },
  { type: "recap", label: "Recap card", icon: "🗓", description: "The latest monthly recap poster.", make: () => ({ type: "recap", period: "month" }) },
  { type: "announcements", label: "Announcements", icon: "📣", description: "Your published announcements.", make: () => ({ type: "announcements", limit: 3 }) },
  { type: "live_ticker", label: "Live ticker", icon: "⚡", description: "Real-time drop feed for your clan.", make: () => ({ type: "live_ticker" }) },
  { type: "buttons", label: "Buttons", icon: "⬢", description: "Link buttons (Discord, WOM, anything).", make: () => ({ type: "buttons", items: [{ label: "Join our Discord", href: "https://" }] }) },
  { type: "image", label: "Image", icon: "🖼", description: "A banner or screenshot.", make: () => ({ type: "image", url: "" }) },
  { type: "divider", label: "Divider", icon: "—", description: "Spacing with an optional rule.", make: () => ({ type: "divider", size: "md", rule: true }) },
  { type: "custom_html", label: "Custom HTML", icon: "‹›", description: "Power-user markup (sanitized on save).", make: () => ({ type: "custom_html", source: "", html: "" }) },
];

export const BLOCK_META: Record<string, { label: string; icon: string; description: string }> =
  Object.fromEntries(BLOCK_CATALOG.map((b) => [b.type, b]));

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  return `b${Date.now().toString(36)}${blockSeq}`;
}

/** Collapsible list of the group-data placeholders authors can paste into
 *  text and custom HTML. */
function TokenReference() {
  return (
    <details className="border-osrs-bronze/30 mt-2 rounded border p-2">
      <summary className="text-osrs-parchment-dark/80 cursor-pointer text-xs font-medium">
        Insert live clan data ({SITE_TOKENS.length} placeholders)
      </summary>
      <p className="text-osrs-parchment-dark/60 mt-2 text-[11px]">
        Paste any of these into your content and it is replaced with your
        clan&apos;s live values when the page renders.
      </p>
      <ul className="mt-2 space-y-1">
        {SITE_TOKENS.map((t) => (
          <li key={t.token} className="flex items-baseline justify-between gap-2 text-[11px]">
            <code className="text-osrs-gold-bright">{t.token}</code>
            <span className="text-osrs-parchment-dark/60 text-right">{t.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function BlockForm({
  block,
  onChange,
  groupId,
}: {
  block: Block;
  onChange: (b: Block) => void;
  groupId: number;
}) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value });
  const type = block.type as string;

  switch (type) {
    case "hero":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Heading">
            <Input
              value={(block.heading as string) ?? ""}
              maxLength={80}
              onChange={(e) => set("heading", e.target.value)}
            />
          </Field>
          <Field label="Tagline (optional)">
            <Input
              value={(block.tagline as string) ?? ""}
              maxLength={200}
              onChange={(e) => set("tagline", e.target.value || undefined)}
            />
          </Field>
          <Field label="Image URL (optional; defaults to the group icon)">
            <Input
              value={(block.image_url as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("image_url", e.target.value || undefined)}
            />
          </Field>
        </div>
      );
    case "markdown":
      return (
        <div>
          <Field label="Markdown">
            <Textarea
              className="min-h-32 font-mono text-xs"
              value={(block.body as string) ?? ""}
              maxLength={8000}
              onChange={(e) => set("body", e.target.value)}
            />
          </Field>
          <TokenReference />
        </div>
      );
    case "stats_row": {
      const chosen = new Set((block.stats as string[]) ?? []);
      const toggle = (k: string) => {
        const next = new Set(chosen);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        set("stats", Array.from(next));
      };
      return (
        <div className="flex flex-wrap gap-3 text-sm">
          {(["members", "monthly_loot", "rank", "top_player"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" checked={chosen.has(k)} onChange={() => toggle(k)} />
              {k.replace("_", " ")}
            </label>
          ))}
        </div>
      );
    }
    case "top_players":
    case "recent_drops":
    case "boss_activity":
    case "leaderboard":
    case "announcements":
    case "wom_achievements":
      return (
        <Field label="How many entries">
          <QuantityInput
            className={numField}
            min={3}
            max={25}
            value={(block.limit as number) ?? 10}
            onChange={(limit) => set("limit", limit)}
          />
        </Field>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Image URL">
            <Input
              value={(block.url as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("url", e.target.value)}
            />
          </Field>
          <Field label="Alt text">
            <Input
              value={(block.alt as string) ?? ""}
              maxLength={200}
              onChange={(e) => set("alt", e.target.value || undefined)}
            />
          </Field>
          <Field label="Caption (optional)">
            <Input
              value={(block.caption as string) ?? ""}
              maxLength={300}
              onChange={(e) => set("caption", e.target.value || undefined)}
            />
          </Field>
        </div>
      );
    case "buttons": {
      const items = (block.items as Array<{ label: string; href: string }>) ?? [];
      const update = (i: number, k: "label" | "href", v: string) => {
        const next = items.map((item, j) => (j === i ? { ...item, [k]: v } : item));
        set("items", next);
      };
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="Label"
                maxLength={40}
                value={item.label}
                onChange={(e) => update(i, "label", e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="https://…"
                maxLength={300}
                value={item.href}
                onChange={(e) => update(i, "href", e.target.value)}
              />
              <button
                type="button"
                className="text-osrs-red text-sm"
                onClick={() => set("items", items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          {items.length < 6 && (
            <button
              type="button"
              className="text-osrs-gold text-sm underline"
              onClick={() => set("items", [...items, { label: "", href: "https://" }])}
            >
              + add button
            </button>
          )}
        </div>
      );
    }
    case "lootboard":
      return (
        <Field label="Period">
          <Select
            value={(block.period as string) ?? "month"}
            onChange={(e) => set("period", e.target.value)}
          >
            <option value="month">This month</option>
            <option value="week">This week</option>
            <option value="all">All time</option>
          </Select>
        </Field>
      );
    case "recap":
      return (
        <Field label="Period">
          <Select
            value={(block.period as string) ?? "month"}
            onChange={(e) => set("period", e.target.value)}
          >
            <option value="month">Latest monthly recap</option>
            <option value="year">Latest yearly recap</option>
          </Select>
        </Field>
      );
    case "pb_board": {
      const selections =
        (block.bosses as Array<{ npc_id: number; name?: string; team_sizes: string[] }>) ??
        (block.boss_id ? [{ npc_id: block.boss_id as number, team_sizes: [] }] : []);
      return (
        <PbBossSelect
          groupId={groupId}
          value={selections}
          onChange={(next) => onChange({ ...block, bosses: next, boss_id: undefined })}
        />
      );
    }
    case "member_roster":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Members shown">
              <QuantityInput
                className={numField}
                min={5}
                max={100}
                value={(block.limit as number) ?? 25}
                onChange={(limit) => set("limit", limit)}
              />
            </Field>
            <Field label="Default sort">
              <Select
                value={(block.sort as string) ?? "monthly"}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="monthly">Loot this month</option>
                <option value="all_time">Loot all time</option>
                <option value="name">Name (A–Z)</option>
              </Select>
            </Field>
            <Field label="Layout">
              <Select
                value={(block.layout as string) ?? "cards"}
                onChange={(e) => set("layout", e.target.value)}
              >
                <option value="cards">Cards</option>
                <option value="table">Table</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={(block.show_rank as boolean) ?? true}
              onChange={(e) => set("show_rank", e.target.checked)}
            />
            Show clan rank (by loot this month)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={(block.sortable as boolean) ?? true}
              onChange={(e) => set("sortable", e.target.checked)}
            />
            Let visitors re-sort the list
          </label>
          <p className="text-osrs-parchment-dark/60 text-[11px]">
            Requires the public member roster toggle in Appearance.
          </p>
        </div>
      );
    case "event_standings":
      return (
        <Field label="Event id (blank = your newest active event)">
          <Input
            type="number"
            className="w-40"
            value={(block.event_id as number) ?? ""}
            onChange={(e) =>
              set("event_id", e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </Field>
      );
    case "npc_board":
      return (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Boss NPC id">
            <Input
              type="number"
              className="w-32"
              value={(block.npc_id as number) || ""}
              onChange={(e) => set("npc_id", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Period">
            <Select
              value={(block.period as string) ?? "month"}
              onChange={(e) => set("period", e.target.value)}
            >
              <option value="month">This month</option>
              <option value="all">All time</option>
            </Select>
          </Field>
          <Field label="Entries">
            <QuantityInput
              className={numField}
              min={3}
              max={25}
              value={(block.limit as number) ?? 10}
              onChange={(limit) => set("limit", limit)}
            />
          </Field>
        </div>
      );
    case "divider":
      return (
        <div className="flex items-center gap-4 text-sm">
          <Field label="Size">
            <Select
              value={(block.size as string) ?? "md"}
              onChange={(e) => set("size", e.target.value)}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </Select>
          </Field>
          <label className="mt-5 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={(block.rule as boolean) ?? true}
              onChange={(e) => set("rule", e.target.checked)}
            />
            show line
          </label>
        </div>
      );
    case "custom_html":
      return (
        <div>
          <Field label="HTML source (sanitized on save — scripts, forms and styles are stripped)">
            <Textarea
              className="min-h-40 font-mono text-xs"
              value={(block.source as string) ?? ""}
              onChange={(e) => set("source", e.target.value)}
            />
          </Field>
          <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
            Allowed: headings, text, lists, tables, images and https links. The saved result is
            what renders — use the draft preview to see it exactly.
          </p>
          <TokenReference />
        </div>
      );
    default:
      return (
        <p className="text-osrs-parchment-dark/60 text-xs">
          This block type has no editable settings here yet.
        </p>
      );
  }
}
