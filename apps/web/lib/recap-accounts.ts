/**
 * The `recap_accounts` account setting — which linked account(s) the monthly
 * recap DM covers.
 *
 *   ""       → best: whichever account had the biggest month (the default)
 *   "all"    → all:  one card per account that tracked something
 *   "12,34"  → some: exactly those accounts (a single id is stored bare)
 *
 * Mirrors `parse_account_preference` / `format_account_preference` in the
 * backend's services/recap_delivery.py, and the two must agree: this page and
 * the "Choose accounts" button on the recap DM write the same string, and
 * either side tells "changed" from "the same again" by comparing canonical
 * forms (sorted, deduplicated ids).
 */
export type RecapAccountsMode = "best" | "all" | "some";

export type RecapAccounts = { mode: RecapAccountsMode; ids: number[] };

export function parseRecapAccounts(value: string | null | undefined): RecapAccounts {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return { mode: "best", ids: [] };
  if (raw === "all") return { mode: "all", ids: [] };
  const ids: number[] = [];
  for (const token of raw.split(",")) {
    const part = token.trim();
    if (!/^\d+$/.test(part)) continue;
    const id = Number(part);
    if (!ids.includes(id)) ids.push(id);
  }
  // A value with no usable id reads as the default rather than as "nothing":
  // same rule as the sender, so the page never shows a state it wouldn't send.
  return ids.length ? { mode: "some", ids } : { mode: "best", ids: [] };
}

export function formatRecapAccounts(mode: RecapAccountsMode, ids: number[] = []): string {
  if (mode === "all") return "all";
  if (mode === "some") {
    return Array.from(new Set(ids))
      .sort((a, b) => a - b)
      .join(",");
  }
  return "";
}
