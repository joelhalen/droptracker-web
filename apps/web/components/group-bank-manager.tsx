"use client";

/**
 * Clan bank admin tab (web131a). Staff record GP coming in and going out,
 * review members' pending donations, move GP into an event prize pot, and
 * browse the full ledger.
 *
 * The bank only records GP; the clan trades it in game. Every write goes
 * through a server action that re-checks admin rights, and the backend checks
 * again.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BANK_KIND_LABELS,
  BANK_OUTFLOW_KINDS,
  type BankEntryStatus,
  type BankRecordableKind,
  type GroupBankEntry,
  type GroupBankLedger,
  type GroupBankSummary,
  type Money,
} from "@droptracker/api-types";
import { Alert, Badge, Button, Card, EmptyState, StatTile, fieldInputClass } from "@/components/ui";
import { GpInput } from "@/components/gp-input";
import { GpAmount } from "@/components/gp-amount";
import { ProofAttach, type ProofUpload } from "@/components/proof-attach";
import { formatDate } from "@/lib/format";
import { describeGp } from "@/lib/gp";
import {
  deleteBankEntry,
  loadBankLedger,
  recordBankEntry,
  transferBankToEvent,
  updateBankEntry,
} from "@/app/(site)/(admin)/groups/[id]/bank/actions";

type Filter = BankEntryStatus | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
  { id: "void", label: "Removed" },
];

const KIND_HINTS: Record<BankRecordableKind, string> = {
  donation: "GP a member gave the clan.",
  withdrawal: "GP taken out of the bank.",
  payout: "GP paid to a member, like a prize.",
  adjustment: "Set an opening balance or fix a mistake. Can be negative.",
};

const STATUS_BADGE: Record<BankEntryStatus, { label: string; variant: "green" | "gold" | "red" | "neutral" }> = {
  confirmed: { label: "Confirmed", variant: "green" },
  pending: { label: "Pending", variant: "gold" },
  rejected: { label: "Rejected", variant: "red" },
  void: { label: "Removed", variant: "neutral" },
};

function SignedGp({ money }: { money: Money }) {
  const negative = money.value < 0;
  return (
    <span className={negative ? "text-osrs-red tabular-nums" : "text-osrs-green tabular-nums"}>
      {negative ? "" : "+"}
      {money.value_formatted}
    </span>
  );
}

export function GroupBankManager({
  groupId,
  summary,
  initialLedger,
  initialPending,
}: {
  groupId: number;
  summary: GroupBankSummary;
  initialLedger: GroupBankLedger;
  initialPending: GroupBankEntry[];
}) {
  const router = useRouter();
  const [ledger, setLedger] = useState(initialLedger);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingRows, setPendingRows] = useState<GroupBankEntry[]>(initialPending);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const balance = summary.balance?.value ?? 0;

  /** Re-read the current ledger page and the pending queue, then let the
   * server re-render the headline numbers. */
  async function refresh(nextFilter: Filter = filter) {
    const [page, pending] = await Promise.all([
      loadBankLedger(groupId, { status: nextFilter }),
      loadBankLedger(groupId, { status: "pending" }),
    ]);
    setLedger(page);
    setPendingRows(pending.entries);
    router.refresh();
  }

  function run(task: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await task();
      if (!res.ok) {
        setError(res.message ?? "That didn't work.");
        return;
      }
      if (done) setNotice(done);
      await refresh();
    });
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    startTransition(async () => {
      setLedger(await loadBankLedger(groupId, { status: next }));
    });
  }

  function loadMore() {
    if (ledger.next_before_id == null) return;
    startTransition(async () => {
      const more = await loadBankLedger(groupId, { status: filter, beforeId: ledger.next_before_id });
      setLedger({ ...more, entries: [...ledger.entries, ...more.entries] });
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Balance"
          value={summary.balance ? <GpAmount money={summary.balance} /> : "0"}
          className={balance < 0 ? "ring-osrs-red/50 ring-1" : ""}
        />
        <StatTile
          label="Donated"
          value={summary.donated_total?.value_formatted ?? "0"}
          hint={`${summary.donation_count} donation${summary.donation_count === 1 ? "" : "s"}`}
        />
        <StatTile label="Paid out" value={summary.paid_out_total?.value_formatted ?? "0"} />
        <StatTile label="Waiting for review" value={pendingRows.length} />
      </div>
      {balance < 0 && (
        <Alert variant="info">
          The balance is below zero. If the clan had GP before you started tracking it, record an
          opening balance as an adjustment.
        </Alert>
      )}

      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {pendingRows.length > 0 && (
        <PendingQueue
          rows={pendingRows}
          busy={busy}
          onConfirm={(e) => run(() => updateBankEntry(groupId, e.id, { status: "confirmed" }), "Confirmed.")}
          onReject={(e, reason) =>
            run(
              () => updateBankEntry(groupId, e.id, { status: "rejected", review_note: reason || null }),
              "Rejected.",
            )
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RecordForm
          balance={balance}
          busy={busy}
          onRecord={(input) => run(() => recordBankEntry(groupId, input), "Saved.")}
        />
        <TransferForm
          ledger={ledger}
          balance={balance}
          busy={busy}
          onTransfer={(input) => run(() => transferBankToEvent(groupId, input), "Moved to the event's prize pot.")}
        />
      </div>

      <Card padding="p-0" header={<LedgerHeader filter={filter} onChange={changeFilter} />}>
        {ledger.entries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filter === "all" ? "Nothing recorded yet" : "Nothing here"}
              hint={filter === "all" ? "Record a donation or an opening balance to get started." : undefined}
            />
          </div>
        ) : (
          <ul className="divide-osrs-bronze/15 divide-y">
            {ledger.entries.map((e) => (
              <LedgerRow
                key={e.id}
                entry={e}
                busy={busy}
                onReopen={() => run(() => updateBankEntry(groupId, e.id, { status: "pending" }), "Back in the queue.")}
                onRemove={() => {
                  const what =
                    e.kind === "event_transfer"
                      ? "Remove this transfer? The GP comes back to the bank and leaves the event's prize pot."
                      : "Remove this entry?";
                  if (window.confirm(what)) run(() => deleteBankEntry(groupId, e.id), "Removed.");
                }}
                onProof={(key) => run(() => updateBankEntry(groupId, e.id, { proof_key: key }))}
              />
            ))}
          </ul>
        )}
        {ledger.next_before_id != null && (
          <div className="border-osrs-bronze/15 border-t p-3 text-center">
            <Button variant="ghost" size="sm" disabled={busy} onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function LedgerHeader({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-osrs-gold font-semibold">Ledger</h3>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded border px-2 py-0.5 text-xs ${
              filter === f.id
                ? "border-osrs-gold/60 text-osrs-gold-bright bg-osrs-gold/10"
                : "border-osrs-bronze/30 text-osrs-parchment-dark/70 hover:border-osrs-gold/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function entryWho(e: GroupBankEntry): string {
  if (e.kind === "event_transfer") return e.event_name ? `To ${e.event_name}` : "To an event";
  return e.rsn ?? "";
}

function LedgerRow({
  entry: e,
  busy,
  onReopen,
  onRemove,
  onProof,
}: {
  entry: GroupBankEntry;
  busy: boolean;
  onReopen: () => void;
  onRemove: () => void;
  onProof: (key: string | null) => void;
}) {
  const status = STATUS_BADGE[e.status];
  const editable = e.status !== "void";
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${e.status === "void" ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{BANK_KIND_LABELS[e.kind]}</span>
          {entryWho(e) && <span className="text-osrs-parchment-dark/80 truncate">{entryWho(e)}</span>}
          {e.status !== "confirmed" && (
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
          )}
          {e.source !== "staff" && (
            <Badge variant="sky" size="sm">
              {e.source === "discord" ? "Via Discord" : "Self-reported"}
            </Badge>
          )}
        </div>
        <div className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
          {formatDate(e.created_at)}
          {e.submitted_by && <> · by {e.submitted_by}</>}
          {e.note && <> · {e.note}</>}
          {e.review_note && <> · Reason: {e.review_note}</>}
        </div>
      </div>
      <ProofAttach
        url={e.proof_url}
        disabled={busy || !editable}
        onUploaded={editable ? (u: ProofUpload) => onProof(u.key) : undefined}
        onRemove={editable && e.proof_url ? () => onProof(null) : undefined}
      />
      <div className="w-28 text-right font-semibold">
        <SignedGp money={e.amount} />
      </div>
      <div className="flex w-24 justify-end gap-1">
        {e.status === "rejected" && (
          <Button variant="link" size="xs" disabled={busy} onClick={onReopen}>
            Reopen
          </Button>
        )}
        {editable && (
          <Button variant="link" size="xs" disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}

function PendingQueue({
  rows,
  busy,
  onConfirm,
  onReject,
}: {
  rows: GroupBankEntry[];
  busy: boolean;
  onConfirm: (e: GroupBankEntry) => void;
  onReject: (e: GroupBankEntry, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  return (
    <Card
      padding="p-0"
      header={
        <h3 className="text-osrs-gold font-semibold">
          Waiting for review <Badge variant="gold">{rows.length}</Badge>
        </h3>
      }
    >
      <ul className="divide-osrs-bronze/15 divide-y">
        {rows.map((e) => (
          <li key={e.id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {e.kind === "donation" ? (
                    <>
                      {e.rsn ?? "Unknown"} <span className="text-osrs-parchment-dark/60">donated</span>{" "}
                    </>
                  ) : (
                    <>
                      {BANK_KIND_LABELS[e.kind]} {e.rsn && <span className="text-osrs-parchment-dark/60">{e.rsn}</span>}{" "}
                    </>
                  )}
                  <SignedGp money={e.amount} />
                </div>
                <div className="text-osrs-parchment-dark/60 text-xs">
                  {formatDate(e.created_at)}
                  {e.submitted_by && <> · submitted by {e.submitted_by}</>}
                  {e.note && <> · {e.note}</>}
                </div>
              </div>
              <ProofAttach url={e.proof_url} size="md" />
              <div className="flex gap-2">
                <Button variant="success" size="sm" disabled={busy} onClick={() => onConfirm(e)}>
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setRejecting(rejecting === e.id ? null : e.id);
                    setReason("");
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
            {rejecting === e.id && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={reason}
                  maxLength={255}
                  onChange={(ev) => setReason(ev.target.value)}
                  placeholder="Reason (optional, shown to the member)"
                  className={`${fieldInputClass} min-w-0 flex-1`}
                />
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    onReject(e, reason.trim());
                    setRejecting(null);
                  }}
                >
                  Reject donation
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecordForm({
  balance,
  busy,
  onRecord,
}: {
  balance: number;
  busy: boolean;
  onRecord: (input: {
    kind: BankRecordableKind;
    amount: number;
    rsn?: string | null;
    note?: string | null;
    proof_key?: string | null;
  }) => void;
}) {
  const [kind, setKind] = useState<BankRecordableKind>("donation");
  const [rsn, setRsn] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<ProofUpload | null>(null);

  const needsName = kind === "donation" || kind === "payout";
  const isOutflow = BANK_OUTFLOW_KINDS.includes(kind);
  const valid = (kind === "adjustment" ? amount !== 0 : amount > 0) && (!needsName || rsn.trim().length > 0);
  const overdraw = isOutflow && amount > balance;

  return (
    <Card header={<h3 className="text-osrs-gold font-semibold">Record</h3>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(KIND_HINTS) as BankRecordableKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setAmount(0);
              }}
              aria-pressed={kind === k}
              className={`rounded border px-2.5 py-1 text-sm ${
                kind === k
                  ? "border-osrs-gold/60 text-osrs-gold-bright bg-osrs-gold/10"
                  : "border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/40"
              }`}
            >
              {BANK_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs">{KIND_HINTS[kind]}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              {kind === "payout" ? "Paid to" : kind === "donation" ? "Donor" : "Name"}
              {needsName ? "" : " (optional)"}
            </span>
            <input
              type="text"
              value={rsn}
              maxLength={24}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="RSN"
              className={`${fieldInputClass} w-full`}
            />
          </label>
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Amount</span>
            <GpInput
              value={amount}
              min={kind === "adjustment" ? null : 0}
              emptyAs={0}
              onChange={setAmount}
              className="w-full"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Note (optional, staff only)</span>
          <input
            type="text"
            value={note}
            maxLength={255}
            onChange={(e) => setNote(e.target.value)}
            className={`${fieldInputClass} w-full`}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ProofAttach
            url={proof?.public_url ?? null}
            size="md"
            disabled={busy}
            title="Attach a screenshot"
            onUploaded={setProof}
            onRemove={() => setProof(null)}
          />
          <Button
            disabled={!valid || busy}
            onClick={() => {
              onRecord({
                kind,
                amount,
                rsn: rsn.trim() || null,
                note: note.trim() || null,
                proof_key: proof?.key ?? null,
              });
              setRsn("");
              setAmount(0);
              setNote("");
              setProof(null);
            }}
          >
            Save {BANK_KIND_LABELS[kind].toLowerCase()}
          </Button>
        </div>
        {overdraw && (
          <p className="text-osrs-ember text-xs">
            This is more than the bank holds ({describeGp(balance)}). It will still save.
          </p>
        )}
      </div>
    </Card>
  );
}

function TransferForm({
  ledger,
  balance,
  busy,
  onTransfer,
}: {
  ledger: GroupBankLedger;
  balance: number;
  busy: boolean;
  onTransfer: (input: { event_id: number; amount: number; note?: string | null }) => void;
}) {
  const events = ledger.transfer_events;
  const firstOpen = useMemo(() => events.find((e) => e.pot_enabled)?.id ?? null, [events]);
  const [eventId, setEventId] = useState<number | null>(firstOpen);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const chosen = events.find((e) => e.id === eventId) ?? null;
  const valid = chosen != null && chosen.pot_enabled && amount > 0;

  return (
    <Card header={<h3 className="text-osrs-gold font-semibold">Fund an event</h3>}>
      {events.length === 0 ? (
        <p className="text-osrs-parchment-dark/70 text-sm">
          Move GP from the bank into an event&apos;s prize pot. You don&apos;t have any upcoming or running
          events right now.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-osrs-parchment-dark/60 text-xs">
            Moves GP from the bank into an event&apos;s prize pot. Remove the transfer here to take it back.
          </p>
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Event</span>
            <select
              value={eventId ?? ""}
              onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
              className={`${fieldInputClass} w-full`}
            >
              <option value="">Choose an event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} disabled={!ev.pot_enabled}>
                  {ev.name}
                  {ev.pot_enabled ? "" : " (prize pot is off)"}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Amount</span>
              <GpInput value={amount} min={0} emptyAs={0} onChange={setAmount} className="w-full" />
            </label>
            <label className="block">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Note (optional)</span>
              <input
                type="text"
                value={note}
                maxLength={255}
                onChange={(e) => setNote(e.target.value)}
                className={`${fieldInputClass} w-full`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {amount > balance ? (
              <span className="text-osrs-ember text-xs">More than the bank holds.</span>
            ) : (
              <span />
            )}
            <Button
              disabled={!valid || busy}
              onClick={() => {
                if (eventId == null) return;
                onTransfer({ event_id: eventId, amount, note: note.trim() || null });
                setAmount(0);
                setNote("");
              }}
            >
              Move to prize pot
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
