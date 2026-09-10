/**
 * Clan-point awards (web114a) — pure display helpers shared by the manager
 * tab, the setup wizard, the public event card and the Activity. The rules
 * themselves live server-side (services/event_point_awards.py); these only
 * describe a config and its outcome in words, so every surface says the same
 * thing about the same payout.
 */
import type {
  EventClanPointsConfig,
  EventClanPointsScope,
  EventPointStatus,
} from "@droptracker/api-types";

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

/** 🥇/🥈/🥉 for the podium, "4th" etc. after. */
export function placeBadge(place: number): string {
  return place >= 1 && place <= 3 ? MEDALS[place - 1]! : ordinal(place);
}

/** Trailing zero places pay nothing and are dropped (the backend trims them
 * too), so the editor and the stored config agree. */
export function trimPlacement(amounts: number[]): number[] {
  const out = amounts.map((a) => (Number.isFinite(a) && a > 0 ? Math.floor(a) : 0));
  while (out.length && out[out.length - 1] === 0) out.pop();
  return out;
}

/** Whether an enabled config could pay a single point. */
export function paysAnything(config: EventClanPointsConfig): boolean {
  const p = config.participation;
  return (
    config.enabled &&
    (config.placement.some((a) => a > 0) || p.per_hour > 0 || p.flat > 0)
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** "1st +100 · 2nd +50 · 3rd +25" — the placement offer, or null. */
export function placementSummary(config: EventClanPointsConfig): string | null {
  const parts = config.placement
    .map((amount, i) => (amount > 0 ? `${ordinal(i + 1)} +${fmt(amount)}` : null))
    .filter((x): x is string => x != null);
  return parts.length ? parts.join(" · ") : null;
}

/** The participation offer in one line, or null when it pays nothing.
 * `ehe` false = SOTW/BOTW, where only the flat amount applies. */
export function participationSummary(
  config: EventClanPointsConfig,
  { ehe = true }: { ehe?: boolean } = {},
): string | null {
  const p = config.participation;
  const perHour = ehe && p.per_hour > 0;
  if (!perHour && p.flat <= 0) return null;
  const parts: string[] = [];
  if (perHour) parts.push(`${p.per_hour.toLocaleString("en-US")} per EHE hour`);
  if (p.flat > 0) parts.push(perHour ? `+${fmt(p.flat)} for taking part` : `${fmt(p.flat)} for taking part`);
  const conditions: string[] = [];
  if (ehe && p.min_hours > 0) conditions.push(`min ${p.min_hours.toLocaleString("en-US")}h`);
  if (p.max > 0) conditions.push(`max ${fmt(p.max)}`);
  return parts.join(" ") + (conditions.length ? ` (${conditions.join(", ")})` : "");
}

/** What the payout's state means, for the manager's status line. */
export function statusText(
  scope: Pick<EventClanPointsScope, "status" | "config">,
  eventStatus: string,
): string {
  const status: EventPointStatus = scope.status;
  const review = scope.config.award_mode === "review";
  if (status === "awarded") return "Awarded";
  if (status === "revoked") return "Revoked — nothing is paid until you award again";
  if (status === "deferred") return "Waiting to price EHE — retrying automatically";
  if (eventStatus !== "past") {
    return review
      ? "You'll review and award once the event ends"
      : "Awarded automatically when the event ends";
  }
  return review ? "Ready for your review" : "Not awarded yet";
}

/** A payout the public should see: offered, or already paid. */
export function isPublicScope(scope: EventClanPointsScope): boolean {
  return scope.status === "awarded" || paysAnything(scope.config);
}
