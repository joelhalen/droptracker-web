/**
 * Clan bank (web131a): a group-level GP ledger (backend
 * `web_api/routes/group_bank.py`).
 *
 * Every row moves GP in or out of the clan's bank: a member's donation, a
 * withdrawal or payout, a transfer into one of the group's event prize pots,
 * or a staff adjustment. Amounts are signed (outflows negative) and only
 * confirmed rows count toward the balance. Timestamps are unix seconds.
 *
 * Holders (web159a): the coffer holds at most 50M, so clans keep GP with their
 * staff. A row's holder is whose keeping it moved GP into or out of. GP moving
 * between the coffer and a holder, or between two holders, stays out of the
 * balance (see `isHeldMove` in apps/web/lib/group-bank.ts).
 */
import { z } from "zod";

// Same shape as index.ts's MoneySchema. Re-declared because index.ts
// re-exports this module, and importing back from it would read the schema
// before index.ts has defined it.
const BankMoneySchema = z.object({
  value: z.number().int(),
  value_formatted: z.string(),
});

export const BANK_ENTRY_KINDS = [
  "donation",
  "withdrawal",
  "payout",
  "event_transfer",
  "adjustment",
  "holder_transfer",
] as const;
export type BankEntryKind = (typeof BANK_ENTRY_KINDS)[number];

/** Kinds staff record directly. Transfers have their own action. */
export const BANK_RECORDABLE_KINDS = ["donation", "withdrawal", "payout", "adjustment", "holder_transfer"] as const;
export type BankRecordableKind = (typeof BANK_RECORDABLE_KINDS)[number];

export const BANK_OUTFLOW_KINDS: readonly BankEntryKind[] = ["withdrawal", "payout", "event_transfer"];

export const BANK_ENTRY_STATUSES = ["pending", "confirmed", "rejected", "void"] as const;
export type BankEntryStatus = (typeof BANK_ENTRY_STATUSES)[number];

/** `coffer` rows were synced from an in-game clan coffer broadcast (web144a). */
export const BANK_ENTRY_SOURCES = ["staff", "member", "discord", "coffer"] as const;
export type BankEntrySource = (typeof BANK_ENTRY_SOURCES)[number];

export const BANK_KIND_LABELS: Record<BankEntryKind, string> = {
  donation: "Donation",
  withdrawal: "Withdrawal",
  payout: "Payout",
  event_transfer: "Event transfer",
  adjustment: "Adjustment",
  holder_transfer: "Internal transfer",
};

export const GroupBankEntrySchema = z.object({
  id: z.number().int(),
  kind: z.enum(BANK_ENTRY_KINDS),
  /** Signed: outflows are negative. */
  amount: BankMoneySchema,
  status: z.enum(BANK_ENTRY_STATUSES),
  source: z.enum(BANK_ENTRY_SOURCES).catch("staff"),
  player_id: z.number().int().nullable().default(null),
  /** Donor or recipient: a tracked account's current name, or free text. */
  rsn: z.string().nullable().default(null),
  /** Staff-only; null on public reads. */
  note: z.string().nullable().default(null),
  review_note: z.string().nullable().default(null),
  proof_url: z.string().nullable().default(null),
  event_id: z.number().int().nullable().default(null),
  /** A DropTracker event's name, or the clan's own name for an outside event. */
  event_name: z.string().nullable().default(null),
  /** A transfer to an event run outside DropTracker (no prize-pot row). */
  outside_event: z.boolean().default(false),
  /** Whose keeping this moved GP into or out of: who holds a withdrawal, who
   * returned a deposit, who paid a payout or funded an event, who passed GP on
   * in an internal transfer (`rsn` is who received it). */
  holder_player_id: z.number().int().nullable().default(null),
  holder_rsn: z.string().nullable().default(null),
  /** Username of the member who submitted it (staff reads only). */
  submitted_by: z.string().nullable().default(null),
  /** When the GP moved. Staff can backdate it; the ledger is ordered by it. */
  created_at: z.number().int().nullable().default(null),
  confirmed_at: z.number().int().nullable().default(null),
});
export type GroupBankEntry = z.infer<typeof GroupBankEntrySchema>;

export const GroupBankDonorSchema = z.object({
  player_id: z.number().int().nullable().default(null),
  rsn: z.string().nullable().default(null),
  total: BankMoneySchema,
  count: z.number().int().default(0),
});
export type GroupBankDonor = z.infer<typeof GroupBankDonorSchema>;

export const GroupBankHolderSchema = z.object({
  player_id: z.number().int().nullable().default(null),
  rsn: z.string().nullable().default(null),
  held: BankMoneySchema,
});
export type GroupBankHolder = z.infer<typeof GroupBankHolderSchema>;

/** `GET /groups/{id}/bank`. `visible: false` means the group keeps its bank
 * private and nothing else is sent. */
export const GroupBankSummarySchema = z.object({
  visible: z.boolean(),
  can_manage: z.boolean().default(false),
  show_on_profile: z.boolean().default(true),
  show_donors: z.boolean().default(true),
  balance: BankMoneySchema.optional(),
  donated_total: BankMoneySchema.optional(),
  /** Every outflow together; the three below split it by kind. */
  paid_out_total: BankMoneySchema.optional(),
  withdrawn_total: BankMoneySchema.optional(),
  payout_total: BankMoneySchema.optional(),
  transferred_total: BankMoneySchema.optional(),
  /** `bank_coffer_withdrawals_neutral`: synced coffer withdrawals are GP
   * moved out of the coffer, not spent. They stay in the ledger but leave the
   * balance and the totals above, and are summed here instead. */
  coffer_withdrawals_neutral: z.boolean().default(false),
  /** GP the clan's staff hold outside the coffer: the sum of `holders`. */
  held_outside_coffer_total: BankMoneySchema.optional(),
  /** Who holds it, most first (staff reads only; null for the public). Below
   * zero means more was paid from them than was recorded as held. */
  holders: z.array(GroupBankHolderSchema).nullable().default(null),
  adjustment_total: BankMoneySchema.optional(),
  donation_count: z.number().int().default(0),
  donor_count: z.number().int().default(0),
  /** null when the group hides donor names from the public. */
  top_donors: z.array(GroupBankDonorSchema).nullable().default(null),
  recent: z.array(GroupBankEntrySchema).nullable().default(null),
  pending_count: z.number().int().default(0),
  /** False until anything has been confirmed. */
  has_activity: z.boolean().default(false),
});
export type GroupBankSummary = z.infer<typeof GroupBankSummarySchema>;

export const GroupBankTransferEventSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  status: z.string(),
  pot_enabled: z.boolean(),
});
export type GroupBankTransferEvent = z.infer<typeof GroupBankTransferEventSchema>;

/** `GET /groups/{id}/bank/entries` (staff). */
/** A name the group has funded an outside event under, with its running total. */
export const GroupBankOutsideEventSchema = z.object({
  name: z.string(),
  total: BankMoneySchema,
  count: z.number().int().default(0),
  last_at: z.number().int().nullable().default(null),
});
export type GroupBankOutsideEvent = z.infer<typeof GroupBankOutsideEventSchema>;

export const GroupBankLedgerSchema = z.object({
  entries: z.array(GroupBankEntrySchema),
  next_before_id: z.number().int().nullable().default(null),
  pending_count: z.number().int().default(0),
  transfer_events: z.array(GroupBankTransferEventSchema).default([]),
  outside_events: z.array(GroupBankOutsideEventSchema).default([]),
});
export type GroupBankLedger = z.infer<typeof GroupBankLedgerSchema>;
