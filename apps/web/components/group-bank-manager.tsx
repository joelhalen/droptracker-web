"use client";

/**
 * Clan bank admin tab (web131a). Staff record GP coming in and going out,
 * review members' pending donations, move GP into an event prize pot (or set
 * it aside for an event run outside DropTracker), and
 * browse the full ledger, editing any entry in place.
 *
 * Holders (suggestion #160): GP outside the coffer sits with the clan's
 * staff. Withdrawals can be kept by someone, payouts and event funding can
 * say who paid, internal transfers pass GP between holders, and a deposit
 * can be marked as held GP going back. The Holders card shows who has what.
 *
 * The bank only records GP; the clan trades it in game. Every write goes
 * through a server action that re-checks admin rights, and the backend checks
 * again.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BANK_KIND_LABELS,
  BANK_OUTFLOW_KINDS,
  type BankEntryKind,
  type BankEntrySource,
  type BankEntryStatus,
  type BankRecordableKind,
  type GroupBankEntry,
  type GroupBankHolder,
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
  EARLIEST_BANK_DAY,
  bankLedgerCsv,
  dayToUnix,
  hasHolder,
  holderNote,
  isCofferMove,
  isHeldMove,
  localDay,
  todayLocal,
} from "@/lib/group-bank";
import {
  deleteBankEntry,
  exportBankLedger,
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
  withdrawal: "GP taken out of the bank, or out of the coffer for someone to hold.",
  payout: "GP paid to a member, like a prize.",
  adjustment: "Set an opening balance or fix a mistake. Can be negative.",
  holder_transfer: "GP passed from one holder to another. Doesn't change the balance.",
};

/** The datalist every holder field suggests names from. */
const HOLDERS_LIST_ID = "bank-holders";

/** What the holder field is called for each kind. */
const HOLDER_LABELS: Record<BankEntryKind, string> = {
  donation: "Returned by",
  withdrawal: "Held by",
  payout: "Paid by",
  event_transfer: "Paid by",
  adjustment: "Held by",
  holder_transfer: "From",
};

/** Matches the backend's services/group_bank.holder_key for free-text names. */
function nameKey(name: string | null | undefined): string {
  return (name ?? "").replace(/[-_]/g, " ").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

/** The holder this row's person is, if they hold any GP right now. */
function currentHolder(e: GroupBankEntry, holders: GroupBankHolder[]): GroupBankHolder | null {
  return (
    holders.find((h) =>
      h.held.value > 0 && (h.player_id != null ? h.player_id === e.player_id : nameKey(h.rsn) === nameKey(e.rsn)),
    ) ?? null
  );
}

const STATUS_BADGE: Record<BankEntryStatus, { label: string; variant: "green" | "gold" | "red" | "neutral" }> = {
  confirmed: { label: "Confirmed", variant: "green" },
  pending: { label: "Pending", variant: "gold" },
  rejected: { label: "Rejected", variant: "red" },
  void: { label: "Removed", variant: "neutral" },
};

/** Where a row came from, for anything staff didn't record themselves. */
const SOURCE_LABELS: Record<Exclude<BankEntrySource, "staff">, string> = {
  member: "Self-reported",
  discord: "Via Discord",
  coffer: "In-game coffer",
};

function SourceBadge({ source }: { source: BankEntrySource }) {
  if (source === "staff") return null;
  return (
    <Badge variant="sky" size="sm">
      {SOURCE_LABELS[source]}
    </Badge>
  );
}

/** A ledger row's amount. `muted` is a held move: listed, not counted. */
function SignedGp({ money, muted = false }: { money: Money; muted?: boolean }) {
  const negative = money.value < 0;
  if (muted) {
    return (
      <span className="text-osrs-parchment-dark/50 tabular-nums" title="GP moving between the coffer and the staff who hold it. Doesn't change the balance.">
        {money.value_formatted.replace(/^-/, "")}
      </span>
    );
  }
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
  const neutral = summary.coffer_withdrawals_neutral;
  const held = summary.held_outside_coffer_total;
  const holders = summary.holders ?? [];
  // Synced withdrawals still lower the balance: point at the setting, since a
  // clan holding GP outside the 50M coffer usually wants them not to.
  const showNeutralHint =
    !neutral && ledger.entries.some((e) => e.source === "coffer" && e.kind === "withdrawal" && e.status === "confirmed");
  // Synced coffer rows but no opening balance: the site starts from 0 while
  // the in-game coffer may not have.
  const showOpeningHint =
    (summary.adjustment_total?.value ?? 0) === 0 && ledger.entries.some((e) => e.source === "coffer");

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

  function exportCsv() {
    setError(null);
    startTransition(async () => {
      const res = await exportBankLedger(groupId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const blob = new Blob([bankLedgerCsv(res.entries, neutral)], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clan-bank-${groupId}-${todayLocal()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (res.truncated) setNotice(`Exported the newest ${res.entries.length.toLocaleString()} entries.`);
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
          hint={held && held.value !== 0 ? `${held.value_formatted} held by staff` : undefined}
          className={balance < 0 ? "ring-osrs-red/50 ring-1" : ""}
        />
        <StatTile
          label="Donated"
          value={summary.donated_total?.value_formatted ?? "0"}
          hint={`${summary.donation_count} donation${summary.donation_count === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Taken out"
          value={summary.paid_out_total?.value_formatted ?? "0"}
          hint={outflowHint(summary)}
        />
        <StatTile label="Waiting for review" value={pendingRows.length} />
      </div>
      {balance < 0 ? (
        <Alert variant="info">
          The balance is below zero. If the clan had GP before you started tracking it, record an
          opening balance as an adjustment.
        </Alert>
      ) : (
        showOpeningHint && (
          <Alert variant="info">
            Coffer sync only sees GP moved since it was turned on. If the coffer already held GP,
            record that amount as an adjustment so the balance here matches the game.
          </Alert>
        )
      )}

      {showNeutralHint && (
        <Alert variant="info">
          Synced coffer withdrawals lower the balance. If your admins take GP out of the coffer to hold it,
          turn on &quot;Coffer withdrawals stay in the bank&quot; in{" "}
          <Link href={`/groups/${groupId}/settings`} className="underline">
            Settings
          </Link>{" "}
          so only payouts and event funding count as GP taken out.
        </Alert>
      )}

      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {pendingRows.length > 0 && (
        <PendingQueue
          rows={pendingRows}
          neutral={neutral}
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

      <datalist id={HOLDERS_LIST_ID}>
        {holders.map((h) => (h.rsn ? <option key={`${h.player_id ?? ""}:${h.rsn}`} value={h.rsn} /> : null))}
      </datalist>

      <HoldersCard holders={holders} />

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
          onTransfer={(input) =>
            run(
              () => transferBankToEvent(groupId, input),
              input.event_name ? `Set aside for ${input.event_name}.` : "Moved to the event's prize pot.",
            )
          }
        />
      </div>

      <Card padding="p-0" header={<LedgerHeader filter={filter} onChange={changeFilter} busy={busy} onExport={exportCsv} />}>
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
                neutral={neutral}
                returner={e.kind === "donation" && e.status === "confirmed" && !hasHolder(e) ? currentHolder(e, holders) : null}
                busy={busy}
                onReopen={() => run(() => updateBankEntry(groupId, e.id, { status: "pending" }), "Back in the queue.")}
                onRemove={() => {
                  const what =
                    e.kind !== "event_transfer"
                      ? "Remove this entry?"
                      : e.outside_event
                        ? "Remove this transfer? The GP comes back to the bank."
                        : "Remove this transfer? The GP comes back to the bank and leaves the event's prize pot.";
                  if (window.confirm(what)) run(() => deleteBankEntry(groupId, e.id), "Removed.");
                }}
                onProof={(key) => run(() => updateBankEntry(groupId, e.id, { proof_key: key }))}
                onReturned={(h) =>
                  run(
                    () =>
                      updateBankEntry(
                        groupId,
                        e.id,
                        h.player_id != null ? { holder_player_id: h.player_id } : { holder_rsn: h.rsn },
                      ),
                    "Marked as returned. It no longer counts as a donation.",
                  )
                }
                onEdit={(patch) => run(() => updateBankEntry(groupId, e.id, patch), "Saved.")}
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

/** Who holds the clan's GP outside the coffer, most first. Someone who has
 * paid out everything they held drops off; below zero means more was paid
 * from them than was recorded as held. */
function HoldersCard({ holders }: { holders: GroupBankHolder[] }) {
  const shown = holders.filter((h) => h.held.value !== 0);
  if (shown.length === 0) return null;
  return (
    <Card padding="p-0" header={<h3 className="text-osrs-gold font-semibold">Holders</h3>}>
      <ul className="divide-osrs-bronze/15 divide-y">
        {shown.map((h) => (
          <li key={`${h.player_id ?? ""}:${h.rsn}`} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{h.rsn ?? "Unknown"}</span>
            {h.held.value < 0 ? (
              <span
                className="text-osrs-red tabular-nums"
                title="More was paid from them than was recorded as held. Record the withdrawal or internal transfer that gave it to them."
              >
                {h.held.value_formatted}
              </span>
            ) : (
              <GpAmount money={h.held} />
            )}
          </li>
        ))}
      </ul>
      <p className="text-osrs-parchment-dark/60 border-osrs-bronze/15 border-t px-4 py-2 text-xs">
        GP staff hold for the clan. It counts in the balance. Withdrawals add to it, payouts and event funding
        they made take it off, and internal transfers move it between them.
      </p>
    </Card>
  );
}

function LedgerHeader({
  filter,
  onChange,
  busy,
  onExport,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  busy: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <h3 className="text-osrs-gold font-semibold">Ledger</h3>
        <Button variant="link" size="xs" disabled={busy} onClick={onExport}>
          Export CSV
        </Button>
      </div>
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

/** "5M withdrawn · 1M paid out", naming only the kinds that happened. */
function outflowHint(summary: GroupBankSummary): string | undefined {
  const parts = [
    [summary.withdrawn_total, "withdrawn"],
    [summary.payout_total, "paid out"],
    [summary.transferred_total, "to events"],
  ] as const;
  const shown = parts.filter(([m]) => (m?.value ?? 0) !== 0).map(([m, label]) => `${m!.value_formatted} ${label}`);
  return shown.length ? shown.join(" · ") : undefined;
}

function entryWho(e: GroupBankEntry): string {
  if (e.kind === "event_transfer") return e.event_name ? `To ${e.event_name}` : "To an event";
  if (e.kind === "holder_transfer") return e.rsn ? `To ${e.rsn}` : "";
  return e.rsn ?? "";
}

type EntryPatch = {
  amount?: number;
  rsn?: string | null;
  holder_player_id?: number | null;
  holder_rsn?: string | null;
  note?: string | null;
  created_at?: number;
  event_name?: string;
};

function LedgerRow({
  entry: e,
  neutral,
  returner,
  busy,
  onReopen,
  onRemove,
  onProof,
  onReturned,
  onEdit,
}: {
  entry: GroupBankEntry;
  neutral: boolean;
  /** Set on a deposit by someone who holds GP: offer to mark it returned. */
  returner: GroupBankHolder | null;
  busy: boolean;
  onReopen: () => void;
  onRemove: () => void;
  onProof: (key: string | null) => void;
  onReturned: (holder: GroupBankHolder) => void;
  onEdit: (patch: EntryPatch) => void;
}) {
  const status = STATUS_BADGE[e.status];
  const editable = e.status !== "void";
  const [editing, setEditing] = useState(false);
  const move = isHeldMove(e, neutral);
  const heldBy = holderNote(e, neutral);
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${e.status === "void" ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{isCofferMove(e, neutral) ? "Out of coffer" : BANK_KIND_LABELS[e.kind]}</span>
          {entryWho(e) && <span className="text-osrs-parchment-dark/80 truncate">{entryWho(e)}</span>}
          {heldBy && (
            <Badge variant="neutral" size="sm">
              {heldBy}
            </Badge>
          )}
          {e.status !== "confirmed" && (
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
          )}
          <SourceBadge source={e.source} />
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
        <SignedGp money={e.amount} muted={move} />
      </div>
      <div className="flex w-36 flex-wrap justify-end gap-1">
        {returner && (
          <Button
            variant="link"
            size="xs"
            disabled={busy}
            title={`${returner.rsn} holds ${returner.held.value_formatted} for the clan. If this deposit was that GP going back, it isn't a new donation.`}
            onClick={() => onReturned(returner)}
          >
            Returned
          </Button>
        )}
        {e.status === "rejected" && (
          <Button variant="link" size="xs" disabled={busy} onClick={onReopen}>
            Reopen
          </Button>
        )}
        {editable && (
          <Button
            variant="link"
            size="xs"
            disabled={busy}
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close" : "Edit"}
          </Button>
        )}
        {editable && (
          <Button variant="link" size="xs" disabled={busy} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      {editing && editable && (
        <EntryEditor
          entry={e}
          neutral={neutral}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            onEdit(patch);
            setEditing(false);
          }}
        />
      )}
    </li>
  );
}

/** Edit an entry in place: who it was from or to, who holds the GP, the
 * amount, the note. The amount is shown the way it was entered (positive GP;
 * an adjustment keeps its sign) and only changed fields are sent. A
 * transfer's amount belongs to the prize-pot row it wrote, so only its note
 * and who paid it can change here; a transfer to an outside event has no pot
 * row, so its event name takes the name's place. */
function EntryEditor({
  entry: e,
  neutral,
  busy,
  onSave,
  onCancel,
}: {
  entry: GroupBankEntry;
  neutral: boolean;
  busy: boolean;
  onSave: (patch: EntryPatch) => void;
  onCancel: () => void;
}) {
  // Fixed: a transfer into a prize pot. An outside event's transfer edits freely.
  const isTransfer = e.kind === "event_transfer" && !e.outside_event;
  const outside = e.kind === "event_transfer" && e.outside_event;
  const signed = e.kind === "adjustment";
  const startAmount = signed ? e.amount.value : Math.abs(e.amount.value);
  const startName = outside ? (e.event_name ?? "") : (e.rsn ?? "");
  const [rsn, setRsn] = useState(startName);
  const [amount, setAmount] = useState(startAmount);
  const [note, setNote] = useState(e.note ?? "");
  const startDay = e.created_at ? localDay(e.created_at) : "";
  const [day, setDay] = useState(startDay);
  const startHolder = e.holder_rsn ?? "";
  const [holder, setHolder] = useState(startHolder);
  const handOver = e.kind === "holder_transfer";
  // A synced coffer withdrawal with no holder set is held by whoever made it.
  const impliedHolder = !e.holder_rsn && isCofferMove(e, neutral) ? e.rsn : null;

  const needsName = e.kind === "donation" || e.kind === "payout" || outside || handOver;
  const patch: EntryPatch = {};
  if (holder.trim() !== startHolder) {
    const name = holder.trim();
    // A cleared holder clears the account link too.
    Object.assign(patch, name ? { holder_rsn: name } : { holder_rsn: null, holder_player_id: null });
  }
  if (!isTransfer) {
    if (rsn.trim() !== startName) {
      if (outside) patch.event_name = rsn.trim();
      else patch.rsn = rsn.trim() || null;
    }
    if (amount !== startAmount) patch.amount = amount;
    if (day && day !== startDay) {
      const ts = dayToUnix(day, e.created_at);
      if (ts != null) patch.created_at = ts;
    }
  }
  if (note.trim() !== (e.note ?? "")) patch.note = note.trim() || null;
  const changed = Object.keys(patch).length > 0;
  const valid =
    (isTransfer || ((signed ? amount !== 0 : amount > 0) && (!needsName || rsn.trim().length > 0))) &&
    (!handOver || holder.trim().length > 0);
  const holderField = (
    <HolderField
      label={HOLDER_LABELS[e.kind]}
      required={handOver}
      value={holder}
      onChange={setHolder}
      placeholder={impliedHolder ?? undefined}
    />
  );

  return (
    <div className="border-osrs-bronze/20 bg-osrs-bronze/5 basis-full space-y-3 rounded border p-3">
      {isTransfer ? (
        <>
          <p className="text-osrs-parchment-dark/60 text-xs">
            A transfer&apos;s amount and date are fixed. Remove it and make a new one to change them.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">{holderField}</div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          {holderField}
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              {outside
                ? "Event"
                : e.kind === "payout"
                  ? "Paid to"
                  : e.kind === "donation"
                    ? "Donor"
                    : handOver
                      ? "To"
                      : "Name"}
              {needsName ? "" : " (optional)"}
            </span>
            <input
              type="text"
              value={rsn}
              maxLength={outside ? 64 : 24}
              onChange={(ev) => setRsn(ev.target.value)}
              placeholder={outside ? "Event name" : "RSN"}
              className={`${fieldInputClass} w-full`}
            />
          </label>
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Amount</span>
            <GpInput
              value={amount}
              min={signed ? null : 0}
              emptyAs={0}
              onChange={setAmount}
              className={`${fieldInputClass} w-full`}
            />
          </label>
          <DateField value={day} onChange={setDay} />
        </div>
      )}
      <label className="block">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Note (optional, staff only)</span>
        <input
          type="text"
          value={note}
          maxLength={255}
          onChange={(ev) => setNote(ev.target.value)}
          className={`${fieldInputClass} w-full`}
        />
      </label>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!changed || !valid || busy} onClick={() => onSave(patch)}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function PendingQueue({
  rows,
  neutral,
  busy,
  onConfirm,
  onReject,
}: {
  rows: GroupBankEntry[];
  neutral: boolean;
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
                      {isCofferMove(e, neutral) ? "Out of coffer" : BANK_KIND_LABELS[e.kind]}{" "}
                      {e.rsn && <span className="text-osrs-parchment-dark/60">{e.rsn}</span>}{" "}
                    </>
                  )}
                  <SignedGp money={e.amount} muted={isHeldMove(e, neutral)} />
                </div>
                <div className="text-osrs-parchment-dark/60 flex flex-wrap items-center gap-x-1 text-xs">
                  <SourceBadge source={e.source} />
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

/** Who holds the GP a row moved: a name, with the clan's holders suggested. */
function HolderField({
  label,
  required = false,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
        {label}
        {required ? "" : " (optional)"}
      </span>
      <input
        type="text"
        value={value}
        maxLength={24}
        list={HOLDERS_LIST_ID}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder ?? "RSN"}
        className={`${fieldInputClass} w-full`}
      />
    </label>
  );
}

/** When the GP moved. Defaults to today; an earlier day backdates the entry. */
function DateField({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  return (
    <label className="block">
      <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Date</span>
      <input
        type="date"
        value={value}
        min={EARLIEST_BANK_DAY}
        max={todayLocal()}
        onChange={(ev) => onChange(ev.target.value)}
        className={`${fieldInputClass} w-full`}
      />
    </label>
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
    holder_rsn?: string | null;
    note?: string | null;
    proof_key?: string | null;
    created_at?: number;
  }) => void;
}) {
  const [kind, setKind] = useState<BankRecordableKind>("donation");
  const [rsn, setRsn] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<ProofUpload | null>(null);
  const [day, setDay] = useState(() => todayLocal());
  // Withdrawals and deposits: the named person is the holder (keeping it, or
  // returning it). Payouts, adjustments and internal transfers name one.
  const [kept, setKept] = useState(false);
  const [holder, setHolder] = useState("");

  const handOver = kind === "holder_transfer";
  const selfHeld = kind === "withdrawal" || kind === "donation";
  const needsName = kind === "donation" || kind === "payout" || handOver;
  const name = rsn.trim();
  const holderName = selfHeld ? (kept && name ? name : null) : holder.trim() || null;
  const isOutflow = BANK_OUTFLOW_KINDS.includes(kind);
  const valid =
    (kind === "adjustment" ? amount !== 0 : amount > 0) &&
    (!needsName || name.length > 0) &&
    (!handOver || (holderName != null && nameKey(holderName) !== nameKey(name)));
  const overdraw = isOutflow && !(kind === "withdrawal" && holderName) && amount > balance;

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
                setKept(false);
                setHolder("");
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

        <div className={`grid gap-3 ${selfHeld ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          {!selfHeld && (
            <HolderField
              label={HOLDER_LABELS[kind]}
              required={handOver}
              value={holder}
              onChange={setHolder}
            />
          )}
          <label className="block">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              {kind === "payout"
                ? "Paid to"
                : kind === "donation"
                  ? "Donor"
                  : kind === "withdrawal"
                    ? "Taken out by"
                    : handOver
                      ? "To"
                      : "Name"}
              {needsName ? "" : " (optional)"}
            </span>
            <input
              type="text"
              value={rsn}
              maxLength={24}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="RSN"
              list={handOver || selfHeld ? HOLDERS_LIST_ID : undefined}
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
              className={`${fieldInputClass} w-full`}
            />
          </label>
          <DateField value={day} onChange={setDay} />
        </div>
        {selfHeld && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={kept}
              disabled={!name}
              onChange={(e) => setKept(e.target.checked)}
              className="mt-1"
            />
            <span>
              {kind === "withdrawal"
                ? "They're holding it for the clan"
                : "Held GP going back into the coffer"}
              <span className="text-osrs-parchment-dark/60 block text-xs">
                {kind === "withdrawal"
                  ? "It stays in the balance and is listed under Holders until they pay it out."
                  : "Not a new donation: it comes off what they hold and the balance stays the same."}
              </span>
            </span>
          </label>
        )}
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
              // Today means "now"; another day is that day, for entering history.
              const backdated = day && day !== todayLocal() ? dayToUnix(day) : null;
              onRecord({
                kind,
                amount,
                rsn: name || null,
                holder_rsn: holderName,
                note: note.trim() || null,
                proof_key: proof?.key ?? null,
                ...(backdated != null ? { created_at: backdated } : {}),
              });
              setRsn("");
              setAmount(0);
              setNote("");
              setProof(null);
              setDay(todayLocal());
              setKept(false);
              setHolder("");
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

type TransferInput = Parameters<typeof transferBankToEvent>[1];

/** Fund an event: one of the group's own (GP goes into its prize pot) or one
 * the clan runs outside DropTracker, named here (the GP is only booked out of
 * the bank). Past outside-event names are offered back so a weekly event
 * keeps one name and one running total. */
function TransferForm({
  ledger,
  balance,
  busy,
  onTransfer,
}: {
  ledger: GroupBankLedger;
  balance: number;
  busy: boolean;
  onTransfer: (input: TransferInput) => void;
}) {
  const events = ledger.transfer_events;
  const pastNames = ledger.outside_events;
  const firstOpen = useMemo(() => events.find((e) => e.pot_enabled)?.id ?? null, [events]);
  const [mode, setMode] = useState<"ours" | "outside">(events.length > 0 ? "ours" : "outside");
  const [eventId, setEventId] = useState<number | null>(firstOpen);
  const [eventName, setEventName] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [day, setDay] = useState(() => todayLocal());
  const [holder, setHolder] = useState("");
  const chosen = events.find((e) => e.id === eventId) ?? null;
  const outside = mode === "outside";
  const valid = amount > 0 && (outside ? eventName.trim().length > 0 : chosen != null && chosen.pot_enabled);

  function submit() {
    const base = { amount, note: note.trim() || null, holder_rsn: holder.trim() || null };
    if (outside) {
      const backdated = day && day !== todayLocal() ? dayToUnix(day) : null;
      onTransfer({
        ...base,
        event_name: eventName.trim(),
        ...(backdated != null ? { created_at: backdated } : {}),
      });
    } else {
      if (eventId == null) return;
      onTransfer({ ...base, event_id: eventId });
    }
    setAmount(0);
    setNote("");
    setDay(todayLocal());
    setHolder("");
  }

  const modes = [
    { id: "ours", label: "DropTracker event" },
    { id: "outside", label: "Other event" },
  ] as const;

  return (
    <Card header={<h3 className="text-osrs-gold font-semibold">Fund an event</h3>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded border px-2.5 py-1 text-sm ${
                mode === m.id
                  ? "border-osrs-gold/60 text-osrs-gold-bright bg-osrs-gold/10"
                  : "border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {outside ? (
          <>
            <p className="text-osrs-parchment-dark/60 text-xs">
              For a clan event you run yourselves, like a weekly prize pool. Name it and the GP is set aside
              for it. Use the same name each week to keep a running total.
            </p>
            <label className="block">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Event name</span>
              <input
                type="text"
                value={eventName}
                maxLength={64}
                list="bank-outside-events"
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Weekly PvM night"
                className={`${fieldInputClass} w-full`}
              />
              <datalist id="bank-outside-events">
                {pastNames.map((ev) => (
                  <option key={ev.name} value={ev.name} />
                ))}
              </datalist>
            </label>
            {pastNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pastNames.slice(0, 8).map((ev) => (
                  <button
                    key={ev.name}
                    type="button"
                    onClick={() => setEventName(ev.name)}
                    title={`${ev.count} ${ev.count === 1 ? "time" : "times"}, ${ev.total.value_formatted} in all`}
                    className={`rounded border px-2 py-0.5 text-xs ${
                      eventName.trim().toLowerCase() === ev.name.toLowerCase()
                        ? "border-osrs-gold/60 text-osrs-gold-bright bg-osrs-gold/10"
                        : "border-osrs-bronze/30 text-osrs-parchment-dark/70 hover:border-osrs-gold/40"
                    }`}
                  >
                    {ev.name} <span className="text-osrs-parchment-dark/50">· {describeGp(ev.total.value)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : events.length === 0 ? (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Move GP from the bank into an event&apos;s prize pot. You don&apos;t have any upcoming or running
            events right now.
          </p>
        ) : (
          <>
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
          </>
        )}

        {(outside || events.length > 0) && (
          <>
            <div className={`grid gap-3 ${outside ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              <HolderField label="Paid by" value={holder} onChange={setHolder} />
              <label className="block">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Amount</span>
                <GpInput
                  value={amount}
                  min={0}
                  emptyAs={0}
                  onChange={setAmount}
                  className={`${fieldInputClass} w-full`}
                />
              </label>
              {outside && <DateField value={day} onChange={setDay} />}
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
              <Button disabled={!valid || busy} onClick={submit}>
                {outside ? "Set aside" : "Move to prize pot"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
