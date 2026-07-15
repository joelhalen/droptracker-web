"use client";

/**
 * Small shared pieces for the Discord Activity's screens — thumb-first rows,
 * loading/error states, and the deep-link-out button. Everything here is
 * props-driven and CSP-safe (relative /img icons come pre-rewritten by the
 * /api/activity BFF).
 */
import type { Submission, TopBoss } from "@droptracker/api-types";
import { NameTile, Skeleton } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import { openExternal } from "@/lib/activity/discord-sdk";
import { npcIcon } from "@/lib/activity/img";
import { gpAmount, gpText } from "@/lib/activity/money";

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-osrs-parchment-dark/60 border-osrs-bronze/30 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
      {children}
    </p>
  );
}

/** All-clear placeholder for a list that's legitimately empty. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-osrs-parchment-dark/55 border-osrs-bronze/25 bg-osrs-surface-1/40 rounded-xl border px-4 py-6 text-center text-sm">
      {children}
    </p>
  );
}

/** Pushed-view header: back chevron + title, sticky above the content. */
export function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright border-osrs-bronze/30 bg-osrs-surface-1 -ml-1 rounded-lg border px-2.5 py-1.5 text-sm"
      >
        ←
      </button>
      <h1 className="text-osrs-gold truncate font-serif text-lg font-semibold">{title}</h1>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="heading-rule text-osrs-gold mt-5 mb-2 pb-1 text-sm font-semibold tracking-wide uppercase">
      {children}
    </h2>
  );
}

/** Generic tappable list row: identicon/icon + title/subtitle + accessory. */
export function PressRow({
  icon,
  name,
  title,
  subtitle,
  right,
  onPress,
}: {
  /** Explicit icon node; falls back to a NameTile identicon from `name`. */
  icon?: React.ReactNode;
  name: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      {icon ?? <NameTile name={name} size="sm" />}
      <span className="min-w-0 flex-1">
        <span className="text-osrs-parchment block truncate text-[13.5px] font-semibold">
          {title ?? name}
        </span>
        {subtitle && (
          <span className="text-osrs-parchment-dark/55 block truncate text-[11.5px]">
            {subtitle}
          </span>
        )}
      </span>
      {right && <span className="shrink-0 text-right tabular-nums">{right}</span>}
    </>
  );
  if (!onPress) {
    return <div className="flex w-full items-center gap-3 px-3 py-2.5 text-left">{body}</div>;
  }
  return (
    <button
      onClick={onPress}
      className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
    >
      {body}
    </button>
  );
}

/** One recent drop/clog/PB row (profile & my-profile achievement feeds). */
export function SubmissionRow({
  submission: s,
  onPlayer,
}: {
  submission: Submission;
  onPlayer?: (id: number) => void;
}) {
  const kindLabel =
    s.type === "pb" ? "Personal best" : s.type === "clog" ? "Collection log" : "Drop";
  const who =
    s.player_name && onPlayer && s.player_id ? (
      <button
        onClick={() => onPlayer(s.player_id!)}
        className="text-osrs-gold-bright hover:underline"
      >
        {s.player_name}
      </button>
    ) : (
      s.player_name
    );
  return (
    <div className="border-osrs-bronze/20 flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
      {s.image_url ? (
        <img
          src={s.image_url}
          alt=""
          className="size-8 shrink-0 object-contain drop-shadow"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : (
        <span aria-hidden className="text-osrs-gold/70 w-8 text-center text-lg">
          ◆
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-osrs-parchment block truncate text-[13px]">
          {s.label}
          {s.quantity != null && s.quantity > 1 && (
            <span className="text-osrs-gold/80"> ×{s.quantity.toLocaleString()}</span>
          )}
        </span>
        <span className="text-osrs-parchment-dark/55 block truncate text-[11px]">
          {kindLabel}
          {s.npc_name ? ` · ${s.npc_name}` : ""}
          {who ? <> · {who}</> : ""} · {formatRelativeTime(s.ts)}
        </span>
      </span>
      {s.value != null && gpAmount(s.value) > 0 && (
        <span className="text-osrs-green shrink-0 text-[12.5px] font-semibold tabular-nums">
          {gpText(s.value)}
        </span>
      )}
    </div>
  );
}

/** Top-bosses meter list (player & group profiles). */
export function BossMeters({ bosses, max = 5 }: { bosses: TopBoss[]; max?: number }) {
  const shown = bosses.slice(0, max);
  const top = gpAmount(shown[0]?.loot) || 1;
  return (
    <div className="space-y-2">
      {shown.map((b) => (
        <div key={b.npc_id} className="flex items-center gap-3">
          <img
            src={npcIcon(b.npc_id)}
            alt=""
            className="size-7 shrink-0 object-contain"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-osrs-parchment truncate text-[12.5px]">{b.name}</span>
              <span className="text-osrs-gold-bright shrink-0 text-[12px] font-semibold tabular-nums">
                {gpText(b.loot)}
              </span>
            </span>
            <span className="bg-osrs-surface-3 mt-1 block h-1.5 overflow-hidden rounded-full">
              <span
                className="bg-osrs-gold/70 block h-full rounded-full"
                style={{ width: `${Math.max(4, Math.round((gpAmount(b.loot) / top) * 100))}%` }}
              />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Defer-to-website button — opens droptracker.io outside the iframe. */
export function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => void openExternal(href)}
      className="border-osrs-bronze/40 bg-osrs-surface-2 text-osrs-parchment hover:border-osrs-gold hover:text-osrs-gold-bright mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition-colors"
    >
      {children}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </button>
  );
}
