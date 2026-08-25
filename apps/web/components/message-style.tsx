"use client";

/**
 * Choosing between the two ways Discord can carry a notification.
 *
 * Group leaders are not Discord developers: "embed" and "components" mean
 * nothing to most of them, and the choice is invisible until members see the
 * result. So the explainer shows the same notification drawn both ways rather
 * than describing them, and the per-type control is a labelled choice between
 * two named styles instead of a "go live" button whose effect you have to
 * already understand.
 *
 * The illustration is static and deliberately not driven by the group's own
 * layout: it answers "what are these two things", which has to be answerable
 * before you have authored anything.
 */
import { useState } from "react";
import { Card } from "@/components/ui";

const ITEM_ICON = "https://www.droptracker.io/img/itemdb/4151.png";

/* ------------------------------------------------------------------ */
/* Static side-by-side illustration                                     */
/* ------------------------------------------------------------------ */

function MiniFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#313338] p-3 font-sans">
      <div className="flex items-start gap-2">
        <div className="bg-osrs-gold/90 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <img src="/images/logo.png" alt="" className="h-5 w-5" />
        </div>
        <div className="min-w-0 grow">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-medium text-white">DropTracker</span>
            <span className="rounded bg-[#5865f2] px-1 text-[9px] font-semibold text-white">
              APP
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The classic bordered card: one thumbnail top-right, fields in columns. */
function EmbedExample() {
  return (
    <MiniFrame>
      <div className="mt-0.5 text-[13px] text-[#dbdee1]">
        <span className="font-semibold">RuneLite Ron</span> received a drop:
      </div>
      <div
        className="mt-1 rounded border-l-4 bg-[#2b2d31] py-2.5 pr-3 pl-3"
        style={{ borderLeftColor: "#c8aa6e" }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 grow">
            <div className="text-[13px] font-semibold text-[#00a8fc]">Abyssal whip</div>
            <div className="mt-0.5 text-[13px] text-[#dbdee1]">
              G/E Value: <code className="rounded bg-black/40 px-1">1,624,461</code>
            </div>
            <div className="mt-2 flex gap-5">
              <div>
                <div className="text-[11px] font-semibold text-[#f2f3f5]">Player Stats</div>
                <div className="text-[12px] text-[#dbdee1]">August total: 48.2M</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#f2f3f5]">Group Stats</div>
                <div className="text-[12px] text-[#dbdee1]">Tracked: 86</div>
              </div>
            </div>
          </div>
          <img src={ITEM_ICON} alt="" className="h-10 w-10 shrink-0 object-contain" />
        </div>
        <div className="mt-2 h-14 rounded bg-[#1e1f22]" />
        <div className="mt-1.5 text-[11px] text-[#949ba4]">Powered by DropTracker</div>
      </div>
    </MiniFrame>
  );
}

/** Components: image beside a chosen line, stacked images, link buttons. */
function ComponentsExample() {
  return (
    <MiniFrame>
      <div
        className="mt-1 rounded border-l-4 bg-[#2b2d31] py-2.5 pr-3 pl-3"
        style={{ borderLeftColor: "#c8aa6e" }}
      >
        <div className="text-[13px] text-[#dbdee1]">
          <span className="font-semibold">RuneLite Ron</span> received a drop:
        </div>
        <hr className="my-2 border-[#3f4147]" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 grow">
            <div className="text-[15px] font-bold text-white">Abyssal whip</div>
            <div className="text-[13px] text-[#dbdee1]">
              G/E Value: <code className="rounded bg-black/40 px-1">1,624,461</code>
            </div>
            <div className="text-[13px] text-[#dbdee1]">
              from <span className="font-semibold">Abyssal demon</span>
            </div>
          </div>
          <img src={ITEM_ICON} alt="" className="h-12 w-12 shrink-0 object-contain" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <div className="h-12 rounded bg-[#1e1f22]" />
          <div className="h-12 rounded bg-[#1e1f22]" />
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded bg-[#4e5058] px-2 py-1 text-[11px] text-white">
            View profile <span className="opacity-70">↗</span>
          </span>
          <span className="rounded bg-[#4e5058] px-2 py-1 text-[11px] text-white">
            Wiki <span className="opacity-70">↗</span>
          </span>
        </div>
      </div>
    </MiniFrame>
  );
}

const EMBED_POINTS = [
  "The bordered card your notifications use today.",
  "One small picture in the corner, screenshot underneath.",
  "Nothing to build — edit the template and you're done.",
];

const COMPONENT_POINTS = [
  "Put a picture beside a line instead of under it — including a personal best next to the player's character.",
  "Show more than one screenshot at once.",
  "Add link buttons, headings and dividers.",
  "You arrange the message yourself, block by block.",
];

/**
 * The "what am I even choosing between" panel. Collapsed by default after the
 * first look would be nice, but a leader lands here once every few months, so
 * it opens expanded and can be folded away.
 */
export function MessageStyleExplainer() {
  const [open, setOpen] = useState(true);

  return (
    <Card padding="p-5" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-osrs-gold text-sm font-semibold">
            Embeds and components — what's the difference?
          </h3>
          <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
            Two ways Discord can carry the same notification. Every type is one or the other —
            Discord won't allow both in a single message — and you pick per type below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright shrink-0 text-xs"
          aria-expanded={open}
        >
          {open ? "Hide examples" : "Show examples"}
        </button>
      </div>

      {open && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-osrs-parchment text-sm font-semibold">Embed</span>
              <span className="border-osrs-bronze/40 text-osrs-parchment-dark/70 rounded border px-1.5 py-0.5 text-[10px]">
                What you have now
              </span>
            </div>
            <EmbedExample />
            <ul className="text-osrs-parchment-dark/70 space-y-1 text-xs">
              {EMBED_POINTS.map((p) => (
                <li key={p} className="flex gap-1.5">
                  <span aria-hidden>•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-osrs-parchment text-sm font-semibold">Components</span>
              <span className="border-osrs-gold/40 text-osrs-gold-bright rounded border px-1.5 py-0.5 text-[10px]">
                More control
              </span>
            </div>
            <ComponentsExample />
            <ul className="text-osrs-parchment-dark/70 space-y-1 text-xs">
              {COMPONENT_POINTS.map((p) => (
                <li key={p} className="flex gap-1.5">
                  <span aria-hidden>•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-osrs-parchment-dark/50 text-xs">
        Not sure? Stay on the embed. Switching is instant and reversible, and your layout is kept
        either way.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Per-type chooser                                                     */
/* ------------------------------------------------------------------ */

function StyleOption({
  title,
  summary,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  summary: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={selected ? undefined : onSelect}
      disabled={disabled || selected}
      aria-pressed={selected}
      className={`rounded border p-3 text-left transition-colors ${
        selected
          ? "border-osrs-gold bg-osrs-gold/10 cursor-default"
          : "border-osrs-bronze/35 hover:border-osrs-bronze hover:bg-osrs-bronze/15 disabled:cursor-not-allowed disabled:opacity-50"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
            selected ? "border-osrs-gold bg-osrs-gold text-osrs-brown-dark" : "border-osrs-bronze/50"
          }`}
        >
          {selected ? "✓" : ""}
        </span>
        <span className="text-osrs-parchment text-sm font-medium">{title}</span>
        {selected && (
          <span className="text-osrs-gold-bright ml-auto text-[10px] tracking-wide uppercase">
            In use
          </span>
        )}
      </span>
      <span className="text-osrs-parchment-dark/70 mt-1 block text-xs">{summary}</span>
    </button>
  );
}

/**
 * The per-notification-type switch. `onChoose` performs the write (it is the
 * same PUT that saves the layout, with `active` flipped), so this component
 * stays presentational and the editor keeps owning persistence.
 */
export function MessageStyleChooser({
  typeLabel,
  isComponents,
  disabled = false,
  canUseComponents,
  onChoose,
}: {
  typeLabel: string;
  isComponents: boolean;
  disabled?: boolean;
  /** False when the layout has no blocks yet — nothing to switch to. */
  canUseComponents: boolean;
  onChoose: (components: boolean) => void;
}) {
  return (
    <div className="border-osrs-bronze/25 space-y-2 border-t pt-4">
      <div className="text-osrs-parchment text-sm font-medium">
        How {typeLabel.toLowerCase()} notifications are sent
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <StyleOption
          title="Embed"
          summary="The bordered card, using your embed template."
          selected={!isComponents}
          disabled={disabled}
          onSelect={() => onChoose(false)}
        />
        <StyleOption
          title="Components"
          summary="The blocks you build below."
          selected={isComponents}
          disabled={disabled || !canUseComponents}
          onSelect={() => onChoose(true)}
        />
      </div>
      <p className="text-osrs-parchment-dark/50 text-xs">
        {isComponents
          ? "Members are seeing the blocks below. Saving edits updates what they get straight away."
          : "Members are seeing the embed. Edit and preview the blocks below as long as you like — nothing changes for them until you switch."}
      </p>
    </div>
  );
}
