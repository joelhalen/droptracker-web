import { apiGet, apiSend, withFallback } from "./_client";
import {
  GroupBankLedgerSchema,
  GroupBankSummarySchema,
  type BankEntryStatus,
  type BankRecordableKind,
  type GroupBankLedger,
  type GroupBankSummary,
} from "@droptracker/api-types";

const ZERO = { value: 0, value_formatted: "0" };

export const groupBankApi = {

  // --- Clan bank (web131a) -------------------------------------------------
  /** The bank headline for a group page: balance, totals, top donors and
   * recent activity. Public; staff also get notes and the pending count. */
  async groupBank(groupId: number): Promise<GroupBankSummary> {
    return withFallback(
      async () =>
        GroupBankSummarySchema.parse(await apiGet(`/groups/${groupId}/bank`, { authed: true })),
      () =>
        GroupBankSummarySchema.parse({
          visible: true,
          balance: ZERO,
          donated_total: ZERO,
          paid_out_total: ZERO,
          adjustment_total: ZERO,
        }),
    );
  },


  /** One page of the ledger, newest first (staff). */
  async groupBankLedger(
    groupId: number,
    opts: { status?: BankEntryStatus | "all"; beforeId?: number | null; limit?: number } = {},
  ): Promise<GroupBankLedger> {
    const q = new URLSearchParams();
    if (opts.status) q.set("status", opts.status);
    if (opts.beforeId != null) q.set("before_id", String(opts.beforeId));
    if (opts.limit != null) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return withFallback(
      async () =>
        GroupBankLedgerSchema.parse(
          await apiGet(`/groups/${groupId}/bank/entries${qs ? `?${qs}` : ""}`, { authed: true }),
        ),
      () => GroupBankLedgerSchema.parse({ entries: [] }),
    );
  },


  /** Staff record a donation, withdrawal, payout or adjustment. `amount` is
   * positive GP (the kind sets the sign); an adjustment carries its own. */
  async recordGroupBankEntry(
    groupId: number,
    input: {
      kind: BankRecordableKind;
      amount: number;
      player_id?: number | null;
      rsn?: string | null;
      note?: string | null;
      /** Object key from the proof uploader; the backend builds the URL. */
      proof_key?: string | null;
      event_id?: number | null;
      status?: "confirmed" | "pending";
    },
  ): Promise<{ id: number }> {
    return (await apiSend("POST", `/groups/${groupId}/bank/entries`, input)) as { id: number };
  },


  /** Edit or review an entry. `proof_key: null` detaches the screenshot. */
  async updateGroupBankEntry(
    groupId: number,
    entryId: number,
    patch: {
      amount?: number;
      status?: "confirmed" | "rejected" | "pending";
      note?: string | null;
      review_note?: string | null;
      proof_key?: string | null;
    },
  ): Promise<{ ok: true }> {
    await apiSend("PATCH", `/groups/${groupId}/bank/entries/${entryId}`, patch);
    return { ok: true };
  },


  /** Void an entry that counted (kept for audit), or delete one that never did. */
  async deleteGroupBankEntry(groupId: number, entryId: number): Promise<{ ok: true; voided: boolean }> {
    return (await apiSend("DELETE", `/groups/${groupId}/bank/entries/${entryId}`, null)) as {
      ok: true;
      voided: boolean;
    };
  },


  /** Move GP from the bank into one of the group's event prize pots. */
  async transferGroupBankToEvent(
    groupId: number,
    input: { event_id: number; amount: number; note?: string | null },
  ): Promise<{ id: number }> {
    return (await apiSend("POST", `/groups/${groupId}/bank/transfer`, input)) as { id: number };
  },
};
