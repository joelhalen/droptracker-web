import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ManualSubmissionsReview } from "@/components/manual-submissions-review";

type Params = Promise<{ id: string }>;

/** Manual-submission review queue (suggestion #45, Phase 2). Admin access is
 * gated by the group admin layout; the backend re-checks on every action. */
export default async function GroupSubmissionsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const queue = await api.manualSubmissions(groupId);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-xl font-semibold">Manual submissions</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Drops submitted on the website that are held for approval under your group&apos;s{" "}
          <span className="text-osrs-parchment-dark">Hold for admin approval</span> policy. Approving
          counts the drop toward this group&apos;s leaderboards (and posts the notification if it
          meets your thresholds); rejecting leaves it off this group entirely. Either way the drop
          still counts globally and for the player&apos;s other groups.
        </p>
      </div>
      <ManualSubmissionsReview groupId={groupId} initial={queue} />
    </section>
  );
}
