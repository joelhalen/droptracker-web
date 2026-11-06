import assert from "node:assert/strict";
import { test } from "node:test";
import { GroupBankEntrySchema, GroupBankLedgerSchema } from "@droptracker/api-types";
import { bankLedgerCsv, dayToUnix, isCofferMove, localDay, todayLocal } from "../lib/group-bank";

const NOW = new Date(2026, 10, 2, 21, 0, 0); // local time

test("a picked day becomes that day's local noon", () => {
  const ts = dayToUnix("2024-05-01", null, NOW)!;
  const d = new Date(ts * 1000);
  assert.equal(localDay(ts), "2024-05-01");
  assert.equal(d.getHours(), 12);
});

test("re-dating keeps the entry's clock time", () => {
  const original = Math.floor(new Date(2026, 9, 30, 8, 15, 30).getTime() / 1000);
  const d = new Date(dayToUnix("2025-01-10", original, NOW)! * 1000);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2025, 0, 10]);
  assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds()], [8, 15, 30]);
});

test("today never lands in the future", () => {
  const late = Math.floor(new Date(2026, 9, 30, 23, 0, 0).getTime() / 1000);
  assert.equal(dayToUnix(todayLocal(NOW), late, NOW), Math.floor(NOW.getTime() / 1000));
});

test("junk input is null", () => {
  assert.equal(dayToUnix("", null, NOW), null);
  assert.equal(dayToUnix("01/05/2024", null, NOW), null);
});

test("ledger CSV is oldest first, signed, and formula-safe", () => {
  const entry = (over: Record<string, unknown>) =>
    GroupBankEntrySchema.parse({
      id: 1,
      kind: "donation",
      amount: { value: 5_000_000, value_formatted: "5M" },
      status: "confirmed",
      source: "coffer",
      ...over,
    });
  const newer = Math.floor(new Date(2026, 10, 2, 12).getTime() / 1000);
  const older = Math.floor(new Date(2024, 4, 1, 12).getTime() / 1000);
  const csv = bankLedgerCsv([
    entry({ id: 2, kind: "withdrawal", amount: { value: -31_069_421, value_formatted: "-31M" }, created_at: newer, rsn: "xCmase" }),
    entry({ id: 1, created_at: older, rsn: "=HYPERLINK(1)", note: 'said "thanks", twice' }),
  ]);
  const [header = "", first = "", second = "", ...rest] = csv.split("\r\n");
  assert.equal(rest.length, 0);
  assert.ok(header.startsWith("Date,Type,Status,Source,Name,Amount (gp)"));
  assert.ok(first.startsWith("2024-05-01,Donation,confirmed,coffer,'=HYPERLINK(1),5000000,yes,"));
  assert.ok(first.includes('"said ""thanks"", twice"'));
  assert.ok(second.startsWith("2026-11-02,Withdrawal,confirmed,coffer,xCmase,-31069421,yes,"));
  // With coffer withdrawals neutral, the same row is listed but not counted.
  const neutral = bankLedgerCsv([entry({ id: 2, kind: "withdrawal", amount: { value: -5, value_formatted: "-5" } })], true);
  assert.ok(neutral.split("\r\n")[1]?.includes(",-5,no,"));
});

test("only synced withdrawals are coffer moves, and only when the setting is on", () => {
  assert.equal(isCofferMove({ kind: "withdrawal", source: "coffer" }, true), true);
  assert.equal(isCofferMove({ kind: "withdrawal", source: "coffer" }, false), false);
  assert.equal(isCofferMove({ kind: "withdrawal", source: "staff" }, true), false);
  assert.equal(isCofferMove({ kind: "donation", source: "coffer" }, true), false);
});

test("an outside event's transfer carries its name and older payloads still parse", () => {
  const base = {
    id: 3,
    kind: "event_transfer",
    amount: { value: -2_000_000, value_formatted: "-2M" },
    status: "confirmed",
    source: "staff",
  };
  const outside = GroupBankEntrySchema.parse({ ...base, event_name: "Weekly PvM", outside_event: true });
  assert.equal(outside.outside_event, true);
  assert.equal(outside.event_name, "Weekly PvM");
  assert.equal(GroupBankEntrySchema.parse(base).outside_event, false);
  const ledger = GroupBankLedgerSchema.parse({
    entries: [],
    outside_events: [{ name: "Weekly PvM", total: { value: 6_000_000, value_formatted: "6M" }, count: 3 }],
  });
  assert.equal(ledger.outside_events[0]?.count, 3);
  assert.deepEqual(GroupBankLedgerSchema.parse({ entries: [] }).outside_events, []);
});
