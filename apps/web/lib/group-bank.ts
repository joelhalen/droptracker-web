/**
 * Clan bank helpers that don't touch React: the entry date picker's day <->
 * unix-seconds conversion (in the viewer's own time zone) and the ledger CSV.
 */
import { BANK_KIND_LABELS, type GroupBankEntry } from "@droptracker/api-types";

/** A synced coffer withdrawal the group counts as GP held outside the
 * coffer, not spent (`bank_coffer_withdrawals_neutral`; mirrors the backend's
 * services/group_bank.is_coffer_move). */
export function isCofferMove(e: Pick<GroupBankEntry, "kind" | "source">, neutral: boolean): boolean {
  return neutral && e.kind === "withdrawal" && e.source === "coffer";
}

/** Old School's launch; the backend refuses anything earlier. */
export const EARLIEST_BANK_DAY = "2013-02-22";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" for a moment, in local time (what `<input type="date">` holds). */
export function localDay(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return localDay(Math.floor(now.getTime() / 1000));
}

/** Unix seconds for `day` at a local time of day. `timeOf` keeps that
 * moment's clock time (re-dating an entry keeps its order within the day);
 * without it the day's noon is used. Never later than `now`, so picking
 * today can't land in the future. */
export function dayToUnix(day: string, timeOf: number | null = null, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const at = timeOf != null ? new Date(timeOf * 1000) : null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    at ? at.getHours() : 12,
    at ? at.getMinutes() : 0,
    at ? at.getSeconds() : 0,
  );
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(Math.min(d.getTime(), now.getTime()) / 1000);
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  // Leading =, +, - or @ would run as a formula in a spreadsheet; names and
  // notes are typed by people.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_HEADER = [
  "Date",
  "Type",
  "Status",
  "Source",
  "Name",
  "Amount (gp)",
  "In balance",
  "Event",
  "Note",
  "Submitted by",
  "Review note",
  "Screenshot",
];

/** The whole ledger as CSV, oldest first, with signed raw amounts. "In
 * balance" says whether the row counts: confirmed, and not a coffer move. */
export function bankLedgerCsv(entries: GroupBankEntry[], cofferWithdrawalsNeutral = false): string {
  const rows = [...entries]
    .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0) || a.id - b.id)
    .map((e) => [
      e.created_at ? localDay(e.created_at) : "",
      BANK_KIND_LABELS[e.kind],
      e.status === "void" ? "removed" : e.status,
      e.source,
      e.rsn,
      e.amount.value,
      e.status === "confirmed" && !isCofferMove(e, cofferWithdrawalsNeutral) ? "yes" : "no",
      e.event_name,
      e.note,
      e.submitted_by,
      e.review_note,
      e.proof_url,
    ]);
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
