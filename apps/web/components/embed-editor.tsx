"use client";

/**
 * Custom Discord embed builder (custom_embeds entitlement). One template per
 * notification type; edits are previewed live in a Discord-styled panel with
 * placeholders substituted by sample data. Saving goes through the
 * `saveGroupEmbedAction` Server Action (auth + entitlement re-checked there
 * and again in the Web API).
 */
import { useMemo, useState, useTransition } from "react";
import {
  EMBED_TYPES,
  EMBED_TYPE_LABELS,
  type EmbedType,
  type GroupEmbed,
  type GroupEmbedInput,
  type GroupEmbedsResponse,
} from "@droptracker/api-types";
import {
  resetGroupEmbedAction,
  saveGroupEmbedAction,
} from "@/app/(admin)/groups/[id]/embeds/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Card, fieldInputClass } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Placeholder documentation — mirrors what the notification service    */
/* actually substitutes per type (disc services/notification_service).  */
/* ------------------------------------------------------------------ */
type PlaceholderDoc = { token: string; help: string; sample: string };

const COMMON_MEDIA: PlaceholderDoc[] = [
  { token: "{image_url}", help: "Screenshot URL (when submitted)", sample: "" },
  { token: "{video_url}", help: "Video URL (when submitted)", sample: "" },
  { token: "{video_link}", help: "Markdown link to the video", sample: "" },
];

const PLACEHOLDERS: Record<EmbedType, PlaceholderDoc[]> = {
  drop: [
    { token: "{player_name}", help: "Player who received the drop", sample: "RuneLite Ron" },
    { token: "{item_name}", help: "Item name (linked to the wiki)", sample: "Abyssal whip" },
    { token: "{item_id}", help: "OSRS item id (icon URLs)", sample: "4151" },
    { token: "{item_value}", help: "GE value of a single item", sample: "1,624,461" },
    { token: "{quantity}", help: "Quantity received", sample: "1" },
    { token: "{total_value}", help: "Stack value (value × quantity)", sample: "1,624,461" },
    { token: "{npc_name}", help: "NPC / source name", sample: "Abyssal demon" },
    { token: "{npc_id}", help: "NPC id", sample: "415" },
    { token: "{kill_count}", help: "Kill count at the drop (if tracked)", sample: "1,204" },
    { token: "{month_name}", help: "Current month name", sample: "July" },
    { token: "{player_total_month}", help: "Player's loot total this month", sample: "48.2M" },
    { token: "{group_total_month}", help: "Group's loot total this month", sample: "1.2B" },
    { token: "{global_rank}", help: "Player's global rank", sample: "142" },
    { token: "{group_rank}", help: "Player's rank within the group", sample: "3" },
    { token: "{group_to_group_rank}", help: "Group's rank vs other groups", sample: "17" },
    { token: "{user_count}", help: "Tracked members in the group", sample: "86" },
    { token: "{group_points_awarded}", help: "Group points awarded (if enabled)", sample: "12" },
    { token: "{group_points_receiver_total}", help: "Receiver's point total", sample: "340" },
    ...COMMON_MEDIA,
  ],
  clog: [
    { token: "{player_name}", help: "Player who filled the log slot", sample: "RuneLite Ron" },
    { token: "{item_name}", help: "New collection log item", sample: "Dragon warhammer" },
    { token: "{item_id}", help: "OSRS item id", sample: "13576" },
    { token: "{collection_name}", help: "Collection the item belongs to", sample: "Lizardman Shamans" },
    { token: "{npc_name}", help: "NPC / source name", sample: "Lizardman shaman" },
    { token: "{kc_received}", help: "Kill count when received", sample: "412" },
    { token: "{player_loot_month}", help: "Player's loot total this month", sample: "48.2M" },
    { token: "{total_tracked}", help: "Tracked members in the group", sample: "86" },
    ...COMMON_MEDIA,
  ],
  pb: [
    { token: "{player_name}", help: "Player who set the personal best", sample: "RuneLite Ron" },
    { token: "{npc_name}", help: "Boss / raid name", sample: "Theatre of Blood" },
    { token: "{npc_id}", help: "NPC id", sample: "10852" },
    { token: "{personal_best}", help: "New personal best time", sample: "14:23.4" },
    { token: "{team_size}", help: "Team size for the kill", sample: "4" },
    { token: "{global_rank}", help: "Rank on the global PB board", sample: "58" },
    { token: "{total_ranked_global}", help: "Players ranked globally", sample: "4,120" },
    { token: "{group_rank}", help: "Rank within the group", sample: "1" },
    { token: "{total_ranked_group}", help: "Group members ranked", sample: "22" },
    ...COMMON_MEDIA,
  ],
  ca: [
    { token: "{player_name}", help: "Player who completed the task", sample: "RuneLite Ron" },
    { token: "{task_name}", help: "Combat achievement task", sample: "Perfect Zulrah" },
    { token: "{task_tier}", help: "Tier of the completed task", sample: "Elite" },
    { token: "{points_awarded}", help: "Points from this task", sample: "4" },
    { token: "{total_points}", help: "Player's total CA points", sample: "1,286" },
    { token: "{current_tier}", help: "Player's current CA tier", sample: "Master" },
    { token: "{next_tier}", help: "Next CA tier", sample: "Grandmaster" },
    { token: "{next_tier_points}", help: "Points required for the next tier", sample: "2,005" },
    { token: "{points_left}", help: "Points still needed", sample: "719" },
    { token: "{progress}", help: "Progress toward the next tier", sample: "64%" },
    ...COMMON_MEDIA,
  ],
  pet: [
    { token: "{player_name}", help: "Player who received the pet", sample: "RuneLite Ron" },
    { token: "{pet_name}", help: "Pet name", sample: "Pet zilyana" },
    { token: "{source}", help: "Where the pet came from", sample: "Commander Zilyana" },
    { token: "{npc_name}", help: "NPC name", sample: "Commander Zilyana" },
    { token: "{killcount}", help: "Kill count at the pet", sample: "1,432" },
    { token: "{milestone}", help: "Milestone text", sample: "1,432 kills" },
    { token: "{duplicate}", help: "Whether it's a duplicate", sample: "No" },
    { token: "{previously_owned}", help: "Whether previously owned", sample: "No" },
    ...COMMON_MEDIA,
  ],
  level_up: [
    { token: "{player_name}", help: "Player who leveled up", sample: "RuneLite Ron" },
    { token: "{skill_name}", help: "Skill that leveled", sample: "Slayer" },
    { token: "{skills_names}", help: "All skills that leveled (multi)", sample: "Slayer, Attack" },
    { token: "{skills_text}", help: "Formatted level-up summary", sample: "Slayer 99 (+1)" },
    { token: "{new_level}", help: "New level", sample: "99" },
    { token: "{levels_gained}", help: "Levels gained", sample: "1" },
    { token: "{xp_total}", help: "XP in the leveled skill", sample: "13,034,431" },
    { token: "{total_level}", help: "Player's total level", sample: "2,154" },
    { token: "{total_xp}", help: "Player's total XP", sample: "312,441,092" },
    { token: "{combat_level}", help: "Player's combat level", sample: "126" },
    ...COMMON_MEDIA,
  ],
  quest: [
    { token: "{player_name}", help: "Player who completed the quest", sample: "RuneLite Ron" },
    { token: "{quest_name}", help: "Quest name", sample: "Desert Treasure II" },
    { token: "{quests_completed}", help: "Quests completed", sample: "158" },
    { token: "{total_quests}", help: "Total quests in the game", sample: "165" },
    { token: "{completion_percentage}", help: "Quest completion %", sample: "96%" },
    { token: "{quest_points}", help: "Quest points from this quest", sample: "5" },
    { token: "{total_quest_points}", help: "Player's total quest points", sample: "293" },
    { token: "{qp_percentage}", help: "Quest point completion %", sample: "94%" },
    { token: "{timestamp}", help: "Completion time", sample: "today" },
    ...COMMON_MEDIA,
  ],
  lb: [
    { token: "{next_refresh}", help: "Relative countdown to the next board update", sample: "in 10 minutes" },
    { token: "{tracked_members}", help: "Members tracked in the group", sample: "86" },
  ],
};

const TYPE_HELP: Record<EmbedType, string> = {
  drop: "Posted when a tracked member receives a notable drop.",
  clog: "Posted when a member unlocks a new collection log slot.",
  pb: "Posted when a member sets a new personal best.",
  ca: "Posted when a member completes a combat achievement task.",
  pet: "Posted when a member receives a pet.",
  level_up: "Posted when a member levels up a skill.",
  quest: "Posted when a member completes a quest.",
  lb: "The message that accompanies your group's lootboard image.",
};

/* ------------------------------------------------------------------ */
/* Draft state                                                          */
/* ------------------------------------------------------------------ */
type DraftField = { name: string; value: string; inline: boolean };
type Draft = {
  title: string;
  description: string;
  color: string; // "" = Discord default
  thumbnail: string;
  image: string;
  timestamp: boolean;
  fields: DraftField[];
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  color: "#ffb83f",
  thumbnail: "",
  image: "",
  timestamp: false,
  fields: [],
};

function draftFrom(embed: GroupEmbed | null | undefined): Draft {
  if (!embed) return { ...EMPTY_DRAFT, fields: [] };
  return {
    title: embed.title,
    description: embed.description,
    color: embed.color ?? "",
    thumbnail: embed.thumbnail ?? "",
    image: embed.image ?? "",
    timestamp: embed.timestamp,
    fields: embed.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
  };
}

function toInput(draft: Draft): GroupEmbedInput {
  return {
    title: draft.title.trim(),
    description: draft.description,
    color: /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : null,
    thumbnail: draft.thumbnail.trim() || null,
    image: draft.image.trim() || null,
    timestamp: draft.timestamp,
    fields: draft.fields
      .filter((f) => f.name.trim() && f.value.trim())
      .map((f) => ({ name: f.name.trim(), value: f.value, inline: f.inline })),
  };
}

/* ------------------------------------------------------------------ */
/* Preview helpers                                                      */
/* ------------------------------------------------------------------ */
function substitute(text: string, docs: PlaceholderDoc[], useSamples: boolean): string {
  if (!useSamples) return text;
  let out = text;
  for (const d of docs) {
    if (d.sample) out = out.split(d.token).join(d.sample);
  }
  return out;
}

/** Minimal Discord-flavoured inline markdown for the preview. */
function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{[a-z_]+\})/g;
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__"))
      return <u key={key}>{part.slice(2, -2)}</u>;
    if (part.startsWith("~~") && part.endsWith("~~"))
      return <s key={key}>{part.slice(2, -2)}</s>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
      return <em key={key}>{part.slice(1, -1)}</em>;
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

function PreviewText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {formatInline(line, `l${i}`)}
        </span>
      ))}
    </span>
  );
}

function HiddenOnError({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return null;
  // Plain <img>: preview URLs are arbitrary user input, not next/image targets.
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

function DiscordPreview({
  draft,
  docs,
  useSamples,
}: {
  draft: Draft;
  docs: PlaceholderDoc[];
  useSamples: boolean;
}) {
  const sub = (t: string) => substitute(t, docs, useSamples);
  const stripColor = /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#1e1f22";
  const visibleFields = draft.fields.filter((f) => f.name.trim() || f.value.trim());
  const now = new Date();
  const timeText = `Today at ${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="bg-osrs-gold/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg">
          📊
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-white">DropTracker</span>
            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">{timeText}</span>
          </div>
          <div
            className="mt-1 grid max-w-[520px] rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
            style={{ borderLeftColor: stripColor }}
          >
            <div className="flex gap-4">
              <div className="min-w-0 grow">
                {draft.title.trim() && (
                  <div className="text-[15px] font-semibold text-white">
                    <PreviewText text={sub(draft.title)} />
                  </div>
                )}
                {draft.description.trim() && (
                  <div className="mt-1 text-sm leading-snug text-[#dbdee1]">
                    <PreviewText text={sub(draft.description)} />
                  </div>
                )}
                {visibleFields.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                    {visibleFields.map((f, i) => (
                      <div key={i} className={f.inline ? "col-span-1" : "col-span-3"}>
                        <div className="text-xs font-semibold text-[#f2f3f5]">
                          <PreviewText text={sub(f.name)} />
                        </div>
                        <div className="text-sm text-[#dbdee1]">
                          <PreviewText text={sub(f.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {draft.thumbnail.trim() && (
                <HiddenOnError
                  src={sub(draft.thumbnail)}
                  className="h-16 w-16 shrink-0 rounded object-contain"
                />
              )}
            </div>
            {draft.image.trim() && (
              <HiddenOnError
                src={sub(draft.image)}
                className="mt-3 max-h-64 w-full rounded object-cover"
              />
            )}
            <div className="mt-2 flex items-center gap-1 text-[11px] text-[#949ba4]">
              <span>Powered by DropTracker | droptracker.io</span>
              {draft.timestamp && <span>• {timeText}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */
export function EmbedEditor({
  groupId,
  initial,
}: {
  groupId: number;
  initial: GroupEmbedsResponse;
}) {
  const byType = useMemo(() => {
    const map = new Map(initial.embeds.map((e) => [e.embed_type, e]));
    return map;
  }, [initial]);

  const [selected, setSelected] = useState<EmbedType>("drop");
  const [customByType, setCustomByType] = useState<Partial<Record<EmbedType, GroupEmbed | null>>>(
    () => Object.fromEntries(initial.embeds.map((e) => [e.embed_type, e.custom])),
  );
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(byType.get("drop")?.custom ?? byType.get("drop")?.default),
  );
  const [dirty, setDirty] = useState(false);
  const [useSamples, setUseSamples] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const entry = byType.get(selected);
  const hasCustom = Boolean(customByType[selected]);
  const docs = PLACEHOLDERS[selected];

  const selectType = (t: EmbedType) => {
    if (dirty && !window.confirm("Discard unsaved changes to this embed?")) return;
    setSelected(t);
    const e = byType.get(t);
    setDraft(draftFrom(customByType[t] ?? e?.custom ?? e?.default));
    setDirty(false);
    setMessage(null);
  };

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const updateField = (i: number, patch: Partial<DraftField>) => {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    }));
    setDirty(true);
  };

  const save = () => {
    if (!draft.title.trim()) {
      setMessage({ tone: "error", text: "The embed needs a title." });
      return;
    }
    startTransition(async () => {
      try {
        const saved = await saveGroupEmbedAction(groupId, selected, toInput(draft));
        setCustomByType((m) => ({ ...m, [selected]: saved }));
        setDraft(draftFrom(saved));
        setDirty(false);
        setMessage({ tone: "success", text: "Embed saved — new notifications will use it." });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const reset = () => {
    if (!window.confirm("Remove your custom embed and revert to the DropTracker default?")) return;
    startTransition(async () => {
      try {
        await resetGroupEmbedAction(groupId, selected);
        setCustomByType((m) => ({ ...m, [selected]: null }));
        setDraft(draftFrom(entry?.default));
        setDirty(false);
        setMessage({ tone: "success", text: "Reverted to the default embed." });
      } catch (err) {
        setMessage({ tone: "error", text: getErrorMessage(err) });
      }
    });
  };

  const copyToken = (token: string) => {
    void navigator.clipboard?.writeText(token);
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="flex flex-wrap gap-1">
        {EMBED_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectType(t)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              t === selected
                ? "bg-osrs-bronze text-osrs-parchment"
                : "hover:bg-osrs-bronze/30 text-osrs-parchment-dark/80"
            }`}
          >
            {EMBED_TYPE_LABELS[t]}
            {customByType[t] ? <span className="text-osrs-gold-bright ml-1">•</span> : null}
          </button>
        ))}
      </div>

      <p className="text-osrs-parchment-dark/60 text-xs">
        {TYPE_HELP[selected]}{" "}
        {hasCustom ? "This type uses your custom embed." : "This type currently uses the default embed."}
      </p>

      {message && <Alert variant={message.tone}>{message.text}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <Card padding="p-5" className="space-y-4">
          <div>
            <label className="text-osrs-parchment mb-1 block text-sm font-medium">
              Title <span className="text-osrs-red">*</span>
              <span className="text-osrs-parchment-dark/50 ml-2 text-xs font-normal">
                {draft.title.length}/255
              </span>
            </label>
            <input
              type="text"
              value={draft.title}
              maxLength={255}
              onChange={(e) => update({ title: e.target.value })}
              className={`${fieldInputClass} w-full`}
              placeholder="{item_name} — new drop!"
            />
          </div>

          <div>
            <label className="text-osrs-parchment mb-1 block text-sm font-medium">
              Description
              <span className="text-osrs-parchment-dark/50 ml-2 text-xs font-normal">
                {draft.description.length}/1000
              </span>
            </label>
            <textarea
              value={draft.description}
              maxLength={1000}
              rows={3}
              onChange={(e) => update({ description: e.target.value })}
              className={`${fieldInputClass} w-full`}
              placeholder="**{player_name}** received **{item_name}** from {npc_name}!"
            />
            <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
              Supports Discord markdown: **bold**, *italic*, __underline__, `code`, [link](url).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-osrs-parchment mb-1 block text-sm font-medium">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#1e1f22"}
                  onChange={(e) => update({ color: e.target.value })}
                  className="border-osrs-bronze/40 h-9 w-10 cursor-pointer rounded border bg-transparent"
                  aria-label="Embed color"
                />
                <input
                  type="text"
                  value={draft.color}
                  onChange={(e) => update({ color: e.target.value })}
                  className={`${fieldInputClass} w-full`}
                  placeholder="#ffb83f (blank = default)"
                />
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="text-osrs-parchment flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.timestamp}
                  onChange={(e) => update({ timestamp: e.target.checked })}
                  className="accent-osrs-gold h-4 w-4"
                />
                Show timestamp in footer
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-osrs-parchment mb-1 block text-sm font-medium">
                Thumbnail URL
              </label>
              <input
                type="text"
                value={draft.thumbnail}
                maxLength={200}
                onChange={(e) => update({ thumbnail: e.target.value })}
                className={`${fieldInputClass} w-full`}
                placeholder="https://…/icon/{item_id}.png"
              />
            </div>
            <div>
              <label className="text-osrs-parchment mb-1 block text-sm font-medium">
                Large image URL
              </label>
              <input
                type="text"
                value={draft.image}
                maxLength={200}
                onChange={(e) => update({ image: e.target.value })}
                className={`${fieldInputClass} w-full`}
                placeholder="https://…/banner.png"
              />
            </div>
          </div>

          {/* Fields */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-osrs-parchment text-sm font-medium">
                Fields
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs font-normal">
                  {draft.fields.length}/25
                </span>
              </span>
              <button
                type="button"
                disabled={draft.fields.length >= 25}
                onClick={() =>
                  update({ fields: [...draft.fields, { name: "", value: "", inline: true }] })
                }
                className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-2 py-1 text-xs disabled:opacity-40"
              >
                + Add field
              </button>
            </div>
            <div className="space-y-2">
              {draft.fields.map((f, i) => (
                <div key={i} className="border-osrs-bronze/25 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={f.name}
                      maxLength={256}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      className={`${fieldInputClass} w-full`}
                      placeholder="Field name"
                    />
                    <label className="text-osrs-parchment-dark/80 flex shrink-0 items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={f.inline}
                        onChange={(e) => updateField(i, { inline: e.target.checked })}
                        className="accent-osrs-gold"
                      />
                      Inline
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        update({ fields: draft.fields.filter((_, j) => j !== i) })
                      }
                      className="text-osrs-red/80 hover:text-osrs-red shrink-0 text-sm"
                      aria-label={`Remove field ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={f.value}
                    maxLength={1024}
                    rows={2}
                    onChange={(e) => updateField(i, { value: e.target.value })}
                    className={`${fieldInputClass} mt-2 w-full`}
                    placeholder="Field value — placeholders work here too"
                  />
                </div>
              ))}
              {draft.fields.length === 0 && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  No fields — add key/value blocks like &quot;Value: {"{total_value}"} gp&quot;.
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
              {pending ? "Saving…" : "Save embed"}
            </button>
            {hasCustom && (
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="border-osrs-bronze/40 hover:bg-osrs-bronze/30 rounded border px-4 py-2 text-sm disabled:opacity-50"
              >
                Reset to default
              </button>
            )}
            {dirty && <span className="text-osrs-parchment-dark/60 text-xs">Unsaved changes</span>}
          </div>
        </Card>

        {/* Preview + placeholders */}
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
                Fill placeholders with sample data
              </label>
            </div>
            <DiscordPreview draft={draft} docs={docs} useSamples={useSamples} />
          </Card>

          <Card padding="p-5">
            <h3 className="text-osrs-gold mb-2 text-sm font-semibold">
              Placeholders for {EMBED_TYPE_LABELS[selected].toLowerCase()}
            </h3>
            <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
              Click a placeholder to copy it, then paste it into the title, description, or any
              field. It is replaced with live data when the notification is sent.
            </p>
            <div className="space-y-1.5">
              {docs.map((d) => (
                <button
                  key={d.token}
                  type="button"
                  onClick={() => copyToken(d.token)}
                  title="Click to copy"
                  className="hover:bg-osrs-bronze/20 flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left"
                >
                  <code className="text-osrs-gold-bright shrink-0 text-xs">{d.token}</code>
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
