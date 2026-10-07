import { notFound } from "next/navigation";
import Link from "next/link";
import { requireGroupAdminPage } from "@/lib/auth";
import { api } from "@/lib/api";
import { GroupBankManager } from "@/components/group-bank-manager";

type Params = Promise<{ id: string }>;

/** Clan bank (web131a): the group's GP ledger. Admin access is gated by the
 * group admin layout; the backend re-checks on every action. */
export default async function GroupBankPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events
  if (!Number.isFinite(groupId)) notFound();

  const [summary, ledger, pending] = await Promise.all([
    api.groupBank(groupId),
    api.groupBankLedger(groupId, { status: "all" }),
    api.groupBankLedger(groupId, { status: "pending", limit: 200 }),
  ]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-xl font-semibold">Clan bank</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Keep track of your clan&apos;s GP: donations in, withdrawals and payouts out. The GP itself is
          traded in game; this is the record. Choose what the public sees in{" "}
          <Link href={`/groups/${groupId}/settings`} className="underline">
            Settings
          </Link>
          .
        </p>
      </div>
      <GroupBankManager
        groupId={groupId}
        summary={summary}
        initialLedger={ledger}
        initialPending={pending.entries}
      />
    </section>
  );
}
