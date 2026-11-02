"use client";

/**
 * The recap designer (web154a, suggestion #224): a live editor for what a
 * clan's monthly recap card shows.
 *
 * Left: the controls, grouped the way an admin thinks about the card (look,
 * panels, headline, plaques, standouts, list sizes, message, hidden members).
 * Right: the real `RecapCard` with the edited design applied on every
 * keystroke, so what you see is exactly what gets posted.
 *
 * A design applies to every month (the clan default) or to one month only.
 * Saving writes that level; the month level wins when both exist. All edits
 * are pure functions in lib/recap-design.ts.
 */
import { useMemo, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import {
  RECAP_ACCENTS,
  RECAP_COUNTS,
  RECAP_HEADLINE_MAX,
  RECAP_HERO_STATS,
  RECAP_LAYOUTS,
  RECAP_MAX_HERO_STATS,
  RECAP_MAX_STANDOUTS,
  RECAP_NOTE_BODY_MAX,
  RECAP_NOTE_TITLE_MAX,
  RECAP_STANDOUTS,
  RECAP_TITLE_MAX,
  type Recap,
  type RecapAccent,
  type RecapColumn,
  type RecapCountKey,
  type RecapDesign,
  type RecapDesignAdmin,
} from "@droptracker/api-types";
import { Alert, Badge, Button, Card, Input, Select, Textarea, ToggleChip, cn } from "@/components/ui";
import { RecapCard, formatPeriod } from "@/components/recap-card";
import {
  bodySections,
  cardAvailability,
  columnSections,
  countValue,
  designsEqual,
  moveSection,
  moveStandout,
  placeSection,
  sectionMeta,
  setColumn,
  setCount,
  setNote,
  toggleHeroStat,
  toggleHidden,
  toggleSection,
  toggleStandout,
} from "@/lib/recap-design";
import {
  approveRecap,
  refreshRecapPost,
  regenerateRecap,
  resetRecapDesign,
  saveRecapDesign,
  setRecapReviewMode,
} from "@/app/(site)/(admin)/groups/[id]/recaps/actions";

type Scope = "default" | "month";

const COUNT_LABELS: Record<RecapCountKey, string> = {
  gallery: "Loot gallery items",
  members: "Top members",
  sources: "Top sources",
  skills: "Skills",
  bosses: "Boss kills",
  pets: "New pets",
};

const REVIEW_OPTIONS = [
  { value: "off", label: "Post automatically", hint: "The card goes out on the 1st at your post time." },
  { value: "notify", label: "Message admins first", hint: "Admins get a Discord DM with a link here when the card is ready, then it posts on time." },
  { value: "approve", label: "Wait for approval", hint: "Admins get a DM, and nothing is posted until one of you approves it." },
] as const;

function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Section({ title, hint, children, aside }: { title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card padding="p-4" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-osrs-gold text-sm font-semibold tracking-wide uppercase">{title}</h3>
          {hint && <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        checked ? "border-osrs-gold bg-osrs-gold/70" : "border-osrs-bronze/50 bg-osrs-surface-2",
      )}
    >
      <span
        className={cn(
          "bg-osrs-parchment inline-block h-3.5 w-3.5 rounded-full shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function RecapDesigner({
  groupId,
  groupName,
  period,
  months,
  previewPeriod,
  recap,
  monthState,
  defaultState,
}: {
  groupId: number;
  groupName: string;
  period: string;
  months: string[];
  previewPeriod: string | null;
  recap: Recap | null;
  monthState: RecapDesignAdmin;
  defaultState: RecapDesignAdmin;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Which level is being edited. A month with its own design opens on it.
  const [scope, setScope] = useState<Scope>(monthState.has_month ? "month" : "default");
  const [saved, setSaved] = useState<{ default: RecapDesign; month: RecapDesign }>({
    default: defaultState.design,
    month: monthState.design,
  });
  const [hasMonth, setHasMonth] = useState(monthState.has_month);
  const [hasDefault, setHasDefault] = useState(defaultState.has_default);
  const [draft, setDraft] = useState<RecapDesign>(scope === "month" ? monthState.design : defaultState.design);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(monthState.review_mode);
  const [approvedAt, setApprovedAt] = useState(monthState.approved_at);

  const baseline = scope === "month" ? saved.month : saved.default;
  const dirty = !designsEqual(draft, baseline);
  const avail = useMemo(() => cardAvailability(recap), [recap]);
  const posted = monthState.post?.posted ?? false;
  const monthLabel = formatPeriod(period);
  const update = (fn: (d: RecapDesign) => RecapDesign) => setDraft((d) => fn(d));

  // What the month will actually use once saved: editing the default only
  // shows on this month's card when the month has no design of its own.
  const effectiveNote =
    scope === "default" && hasMonth
      ? `${monthLabel} has its own design, so these defaults apply to other months. Switch to "Only ${monthLabel}" to edit it.`
      : null;

  function switchScope(next: Scope) {
    if (next === scope) return;
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    setScope(next);
    // Starting a month design from scratch copies what the month shows now.
    setDraft(next === "month" ? (hasMonth ? saved.month : saved.default) : saved.default);
    setMessage(null);
  }

  function save() {
    const target = scope === "month" ? period : "";
    startTransition(async () => {
      const res = await saveRecapDesign(groupId, target, draft, previewPeriod ?? period);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      const design = res.data?.design ?? draft;
      setDraft(design);
      setSaved((s) => (scope === "month" ? { ...s, month: design } : { ...s, default: design, month: hasMonth ? s.month : design }));
      if (scope === "month") setHasMonth(true);
      else setHasDefault(true);
      setMessage({
        kind: "success",
        text: posted
          ? "Saved. The card on the site updates within a minute. Use “Update the Discord post” to change the message too."
          : "Saved. The card on the site updates within a minute.",
      });
      router.refresh();
    });
  }

  function reset() {
    const target = scope === "month" ? period : "";
    const what = scope === "month" ? `${monthLabel}'s own design (it will use your clan default)` : "your clan default (back to the standard card)";
    if (!window.confirm(`Remove ${what}?`)) return;
    startTransition(async () => {
      const res = await resetRecapDesign(groupId, target, previewPeriod ?? period);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      const design = res.data?.design ?? draft;
      if (scope === "month") {
        setHasMonth(false);
        setSaved((s) => ({ ...s, month: design }));
      } else {
        setHasDefault(false);
        setSaved((s) => ({ default: design, month: hasMonth ? s.month : design }));
      }
      setDraft(design);
      setMessage({ kind: "info", text: "Removed." });
      router.refresh();
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMessage({ kind: "error", text: res.error ?? "Something went wrong" });
      else {
        setMessage({ kind: "success", text: success });
        after?.();
      }
    });
  }

  /* ── drag and drop for panels ───────────────────────────────────────── */
  function onDragStart(e: DragEvent, key: string) {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }
  function onDrop(e: DragEvent, beforeKey: string | null, column: RecapColumn) {
    e.preventDefault();
    const key = dragKey ?? e.dataTransfer.getData("text/plain");
    setDragKey(null);
    if (key) update((d) => placeSection(d, key, beforeKey, column));
  }

  const twoColumns = draft.layout !== "stacked";

  function panelRow(key: string, column: RecapColumn, scopeMove: "column" | "all") {
    const meta = sectionMeta(key);
    const section = draft.sections.find((s) => s.key === key);
    if (!meta || !section) return null;
    const noData = avail.sections[key] === false && recap !== null;
    return (
      <li
        key={key}
        draggable
        onDragStart={(e) => onDragStart(e, key)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, key, column)}
        className={cn(
          "border-osrs-bronze/30 bg-osrs-surface-2/60 flex items-center gap-2 rounded-lg border px-2 py-2",
          dragKey === key && "opacity-50",
          !section.enabled && "opacity-70",
        )}
      >
        <span className="text-osrs-parchment-dark/40 cursor-grab px-1 select-none" aria-hidden title="Drag to move">
          ⋮⋮
        </span>
        <Switch checked={section.enabled} onChange={(v) => update((d) => toggleSection(d, key, v))} label={`Show ${meta.label}`} />
        <div className="min-w-0 flex-1">
          <div className="text-osrs-parchment flex items-center gap-2 text-sm font-medium">
            {meta.label}
            {noData && section.enabled && (
              <Badge size="sm" variant="neutral" title="This month's card has nothing for this panel, so it is left out.">
                no data this month
              </Badge>
            )}
          </div>
          <div className="text-osrs-parchment-dark/55 truncate text-xs">{meta.help}</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button size="icon" variant="link" aria-label="Move up" onClick={() => update((d) => moveSection(d, key, -1, scopeMove))}>
            ▲
          </Button>
          <Button size="icon" variant="link" aria-label="Move down" onClick={() => update((d) => moveSection(d, key, 1, scopeMove))}>
            ▼
          </Button>
          {twoColumns && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => update((d) => setColumn(d, key, column === "main" ? "side" : "main"))}
              title={column === "main" ? "Move to the side column" : "Move to the main column"}
            >
              {column === "main" ? "→ side" : "← main"}
            </Button>
          )}
        </div>
      </li>
    );
  }

  const members = monthState.members;
  const memberMatches = memberQuery.trim()
    ? members
        .filter((m) => (m.name ?? "").toLowerCase().includes(memberQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  const nameOf = (pid: number) => members.find((m) => m.player_id === pid)?.name ?? `Player ${pid}`;

  return (
    <div className="space-y-4 pb-24">
      {/* ── header: month, scope, status ─────────────────────────────── */}
      <Card padding="p-4" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-osrs-gold text-xl font-bold">Recap designer</h2>
            <p className="text-osrs-parchment-dark/70 text-sm">
              Choose what your monthly recap card shows. The preview is the real card.
            </p>
          </div>
          <label className="text-osrs-parchment-dark/80 flex items-center gap-2 text-sm">
            Month
            <Select
              fieldSize="sm"
              value={period}
              onChange={(e) => {
                if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
                router.push(`/groups/${groupId}/recaps?period=${e.target.value}` as Route);
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatPeriod(m)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-osrs-parchment-dark/70 text-sm">Apply to:</span>
          <ToggleChip shape="tab" active={scope === "default"} onClick={() => switchScope("default")}>
            Every month{hasDefault ? "" : " (standard card)"}
          </ToggleChip>
          <ToggleChip shape="tab" active={scope === "month"} onClick={() => switchScope("month")}>
            Only {monthLabel}
            {hasMonth ? " (customised)" : ""}
          </ToggleChip>
        </div>
        {effectiveNote && <Alert variant="info">{effectiveNote}</Alert>}

        <div className="border-osrs-bronze/25 grid gap-3 border-t pt-3 md:grid-cols-[1fr_auto]">
          <div className="space-y-1 text-sm">
            {!monthState.recaps_enabled ? (
              <p className="text-osrs-parchment-dark/80">
                Monthly recaps are off for this clan, so nothing is posted to Discord. The card is still on your clan page.{" "}
                <Link href={`/groups/${groupId}/settings` as Route} className="text-osrs-gold hover:text-osrs-gold-bright underline">
                  Turn them on in Settings
                </Link>
                .
              </p>
            ) : posted ? (
              <p className="text-osrs-parchment">
                Posted to Discord {fmtWhen(monthState.post?.sent_at) ?? ""}.
                {monthState.guild_id && monthState.post?.channel_id && monthState.post?.message_id && (
                  <>
                    {" "}
                    <a
                      className="text-osrs-gold hover:text-osrs-gold-bright underline"
                      href={`https://discord.com/channels/${monthState.guild_id}/${monthState.post.channel_id}/${monthState.post.message_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open the post
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p className="text-osrs-parchment">
                {monthState.post_due_at ? `Posts ${fmtWhen(monthState.post_due_at)}` : "Not posted yet"}
                {monthState.channel_id ? "" : ". No recap channel is set, so it can't be posted"}
                {reviewMode === "approve" && !approvedAt ? ", once an admin approves it." : "."}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-osrs-parchment-dark/70">Before posting:</span>
              <Select
                fieldSize="sm"
                value={reviewMode}
                disabled={pending}
                onChange={(e) => {
                  const mode = e.target.value as typeof reviewMode;
                  setReviewMode(mode);
                  act(() => setRecapReviewMode(groupId, mode), "Saved.");
                }}
              >
                {REVIEW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <span className="text-osrs-parchment-dark/55 text-xs">
                {REVIEW_OPTIONS.find((o) => o.value === reviewMode)?.hint}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 md:justify-end">
            {reviewMode === "approve" && !posted && monthState.has_snapshot && (
              approvedAt ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => act(() => approveRecap(groupId, period, false), "Approval withdrawn. It won't be posted until approved again.", () => setApprovedAt(null))}
                >
                  ✓ Approved · withdraw
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="success"
                  disabled={pending || dirty}
                  title={dirty ? "Save your changes first" : undefined}
                  onClick={() =>
                    act(
                      () => approveRecap(groupId, period, true),
                      "Approved. It posts at the scheduled time, or within 15 minutes if that has passed.",
                      () => setApprovedAt(new Date().toISOString()),
                    )
                  }
                >
                  Approve for posting
                </Button>
              )
            )}
            {posted && (
              <Button
                size="sm"
                variant="gold-subtle"
                disabled={pending || dirty}
                title={dirty ? "Save your changes first" : "Re-draw the card and edit the Discord message"}
                onClick={() => act(() => refreshRecapPost(groupId, period), "Queued. The Discord post updates within a minute.")}
              >
                Update the Discord post
              </Button>
            )}
          </div>
        </div>

        {monthState.has_snapshot && !monthState.snapshot_has_standouts && (
          <Alert variant="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                This card was made before ranked standouts, skills, boss kills and new pets existed. Rebuild it to add them.
                The numbers are recounted from today&apos;s data.
              </span>
              <Button
                size="xs"
                variant="secondary"
                disabled={pending}
                onClick={() => act(() => regenerateRecap(groupId, period), "Rebuilt. Refreshing the preview…", () => router.refresh())}
              >
                Rebuild this card
              </Button>
            </div>
          </Alert>
        )}
        {!recap && (
          <Alert variant="info">
            There is no card for {monthLabel} yet (cards are made on the 1st, for clans with enough activity).
            {previewPeriod ? ` The preview shows ${formatPeriod(previewPeriod)}.` : " You can still set up a design for future months."}
          </Alert>
        )}
        {message && <Alert variant={message.kind}>{message.text}</Alert>}
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(340px,440px)_1fr]">
        {/* ── controls ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Section title="Look">
            <div className="flex flex-wrap gap-2">
              {RECAP_LAYOUTS.map((l) => (
                <ToggleChip key={l.value} shape="tab" active={draft.layout === l.value} onClick={() => update((d) => ({ ...d, layout: l.value }))}>
                  {l.label}
                </ToggleChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(RECAP_ACCENTS) as RecapAccent[]).map((key) => {
                const a = RECAP_ACCENTS[key];
                const active = (draft.accent || "gold") === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update((d) => ({ ...d, accent: key }))}
                    aria-pressed={active}
                    className="flex cursor-pointer flex-col items-center gap-1 text-xs"
                  >
                    <span
                      className={cn("h-8 w-8 rounded-full border-2", active ? "border-osrs-parchment" : "border-transparent")}
                      style={{ background: `linear-gradient(135deg, ${a.gold}, ${a.bronze})` }}
                    />
                    <span className={active ? "text-osrs-parchment" : "text-osrs-parchment-dark/60"}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Panels"
            hint={twoColumns ? "Switch panels on or off, drag to reorder, or move them between columns." : "Switch panels on or off and drag to reorder."}
          >
            {twoColumns ? (
              <div className="space-y-3">
                {(["main", "side"] as RecapColumn[]).map((column) => (
                  <div key={column}>
                    <div className="text-osrs-parchment-dark/70 mb-1 text-xs font-semibold uppercase">
                      {column === "main" ? "Main column" : "Side column"}
                    </div>
                    <ul
                      className="min-h-10 space-y-1.5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(e, null, column)}
                    >
                      {columnSections(draft, column).map((s) => panelRow(s.key, column, "column"))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5" onDragOver={(e) => e.preventDefault()}>
                {bodySections(draft).map((s) => panelRow(s.key, (s.column ?? "main") as RecapColumn, "all"))}
              </ul>
            )}
            <label className="text-osrs-parchment flex items-center gap-2 pt-1 text-sm">
              <Switch
                checked={draft.sections.find((s) => s.key === "drop")?.enabled ?? true}
                onChange={(v) => update((d) => toggleSection(d, "drop", v))}
                label="Show the drop of the month"
              />
              Drop of the month strip, under the panels
            </label>
          </Section>

          <Section title="Headline">
            <label className="block space-y-1 text-sm">
              <span className="text-osrs-parchment-dark/80 block">Title</span>
              <Input
                className="w-full"
                value={draft.title}
                maxLength={RECAP_TITLE_MAX}
                placeholder={groupName}
                onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-osrs-parchment-dark/80 block">Line under the month</span>
              <Input
                className="w-full"
                value={draft.headline}
                maxLength={RECAP_HEADLINE_MAX}
                placeholder="e.g. Our biggest month yet"
                onChange={(e) => update((d) => ({ ...d, headline: e.target.value }))}
              />
            </label>
          </Section>

          <Section
            title="Stat plaques"
            hint={`The small tiles beside the loot total. Pick up to ${RECAP_MAX_HERO_STATS}, or leave them automatic.`}
            aside={
              draft.hero_stats.length > 0 ? (
                <Button size="xs" variant="link" onClick={() => update((d) => ({ ...d, hero_stats: [] }))}>
                  Automatic
                </Button>
              ) : (
                <Badge size="sm">Automatic</Badge>
              )
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {RECAP_HERO_STATS.map((h) => {
                const i = draft.hero_stats.indexOf(h.key);
                return (
                  <ToggleChip
                    key={h.key}
                    active={i >= 0}
                    disabled={i < 0 && draft.hero_stats.length >= RECAP_MAX_HERO_STATS}
                    onClick={() => update((d) => toggleHeroStat(d, h.key))}
                  >
                    {i >= 0 ? `${i + 1}. ` : ""}
                    {h.label}
                  </ToggleChip>
                );
              })}
            </div>
          </Section>

          <Section
            title="Standouts"
            hint={`The member who led each category. Pick up to ${RECAP_MAX_STANDOUTS}, in the order you want them.`}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-osrs-parchment-dark/80">Show the top</span>
              {[1, 2, 3].map((n) => (
                <ToggleChip key={n} active={draft.standouts_depth === n} onClick={() => update((d) => ({ ...d, standouts_depth: n }))}>
                  {n}
                </ToggleChip>
              ))}
              <span className="text-osrs-parchment-dark/80">in each</span>
            </div>
            {draft.standouts.length > 0 && (
              <ol className="space-y-1">
                {draft.standouts.map((key, i) => {
                  const meta = RECAP_STANDOUTS.find((s) => s.key === key);
                  const has = avail.standouts.has(key);
                  return (
                    <li key={key} className="border-osrs-bronze/30 flex items-center gap-2 rounded border px-2 py-1 text-sm">
                      <span className="text-osrs-parchment-dark/50 w-5 text-right">{i + 1}.</span>
                      <span className="text-osrs-parchment flex-1">{meta?.label ?? key}</span>
                      {!has && recap && <span className="text-osrs-parchment-dark/45 text-xs">nobody this month</span>}
                      <Button size="icon" variant="link" aria-label="Up" onClick={() => update((d) => moveStandout(d, key, -1))}>
                        ▲
                      </Button>
                      <Button size="icon" variant="link" aria-label="Down" onClick={() => update((d) => moveStandout(d, key, 1))}>
                        ▼
                      </Button>
                      <Button size="icon" variant="link" aria-label="Remove" onClick={() => update((d) => toggleStandout(d, key))}>
                        ✕
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="flex flex-wrap gap-1.5">
              {RECAP_STANDOUTS.filter((s) => !draft.standouts.includes(s.key)).map((s) => (
                <ToggleChip
                  key={s.key}
                  disabled={draft.standouts.length >= RECAP_MAX_STANDOUTS}
                  onClick={() => update((d) => toggleStandout(d, s.key))}
                  className={!avail.standouts.has(s.key) && recap ? "opacity-60" : undefined}
                >
                  + {s.label}
                </ToggleChip>
              ))}
            </div>
            {!isEnabledPanel(draft, "standouts") && (
              <p className="text-osrs-parchment-dark/60 text-xs">The Standouts panel is switched off above.</p>
            )}
          </Section>

          <Section title="List sizes">
            <div className="space-y-2">
              {(Object.keys(RECAP_COUNTS) as RecapCountKey[]).map((key) => {
                const [lo, hi] = RECAP_COUNTS[key];
                const value = countValue(draft, key);
                return (
                  <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
                    <span className="text-osrs-parchment-dark/80">{COUNT_LABELS[key]}</span>
                    <span className="text-osrs-gold w-6 text-right font-semibold tabular-nums">{value}</span>
                    <input
                      type="range"
                      min={lo}
                      max={hi}
                      value={value}
                      onChange={(e) => update((d) => setCount(d, key, Number(e.target.value)))}
                      className="accent-osrs-gold col-span-2 w-full"
                    />
                  </label>
                );
              })}
            </div>
          </Section>

          <Section title="Message from the clan" hint="Shout-outs, upcoming events, news. Shown as its own panel.">
            <Input
              className="w-full"
              value={draft.note.title}
              maxLength={RECAP_NOTE_TITLE_MAX}
              placeholder="Title (default: From the clan)"
              onChange={(e) => update((d) => setNote(d, { title: e.target.value }))}
            />
            <Textarea
              className="w-full"
              rows={4}
              value={draft.note.body}
              maxLength={RECAP_NOTE_BODY_MAX}
              placeholder="e.g. Congrats to everyone who got their first infernal cape! Bingo starts on the 15th."
              onChange={(e) => update((d) => setNote(d, { body: e.target.value }))}
            />
            <div className="text-osrs-parchment-dark/50 text-right text-xs">
              {draft.note.body.length}/{RECAP_NOTE_BODY_MAX}
            </div>
          </Section>

          <Section
            title="Hide members"
            hint="Leave alts or staff accounts out of the rankings, standouts and names on the card. Their loot still counts toward clan totals."
          >
            <Input className="w-full" value={memberQuery} placeholder="Search members" onChange={(e) => setMemberQuery(e.target.value)} />
            {memberMatches.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {memberMatches.map((m) => {
                  const hiddenNow = draft.hidden_players.includes(m.player_id);
                  return (
                    <ToggleChip key={m.player_id} active={hiddenNow} onClick={() => update((d) => toggleHidden(d, m.player_id))}>
                      {hiddenNow ? "✓ " : "+ "}
                      {m.name}
                    </ToggleChip>
                  );
                })}
              </div>
            )}
            {draft.hidden_players.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {draft.hidden_players.map((pid) => (
                  <ToggleChip key={pid} active onClick={() => update((d) => toggleHidden(d, pid))} title="Show again">
                    {nameOf(pid)} ✕
                  </ToggleChip>
                ))}
              </div>
            ) : (
              <p className="text-osrs-parchment-dark/50 text-xs">Nobody is hidden.</p>
            )}
          </Section>
        </div>

        {/* ── live preview ───────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-4">
          {recap ? (
            <div className="space-y-2">
              <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-xs">
                <span>
                  Preview · {formatPeriod(recap.period)}
                  {dirty ? " · unsaved" : ""}
                </span>
                <Link href={`/groups/${groupId}/recap/${recap.period}` as Route} className="hover:text-osrs-gold-bright" target="_blank">
                  Open the card ↗
                </Link>
              </div>
              <div className="max-h-[calc(100vh-6rem)] overflow-auto rounded-lg">
                <RecapCard recap={recap} fluid design={draft} />
              </div>
            </div>
          ) : (
            <Card>
              <p className="text-osrs-parchment-dark/70 text-sm">No card to preview yet.</p>
            </Card>
          )}
        </div>
      </div>

      {/* ── save bar ───────────────────────────────────────────────────── */}
      <div className="border-osrs-bronze/40 bg-osrs-surface/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-osrs-parchment-dark/80 text-sm">
            {dirty ? "Unsaved changes" : "All changes saved"} · editing{" "}
            <b className="text-osrs-parchment">{scope === "month" ? `${monthLabel} only` : "every month"}</b>
          </span>
          <div className="flex items-center gap-2">
            {(scope === "month" ? hasMonth : hasDefault) && (
              <Button size="sm" variant="link" disabled={pending} onClick={reset}>
                {scope === "month" ? `Remove ${monthLabel}'s design` : "Back to the standard card"}
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={pending || !dirty} onClick={() => setDraft(baseline)}>
              Discard
            </Button>
            <Button size="sm" disabled={pending || !dirty} loading={pending} loadingLabel="Saving…" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function isEnabledPanel(design: RecapDesign, key: string): boolean {
  return design.sections.find((s) => s.key === key)?.enabled ?? false;
}
