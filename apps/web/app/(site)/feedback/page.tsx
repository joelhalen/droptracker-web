import type { Metadata } from "next";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { FeedbackPage } from "@/components/feedback/feedback-page";

/**
 * Share feedback any time (web155a). The same questions as the feedback card
 * staff send from /admin/feedback, without needing to be asked. Linked from
 * the group admin header.
 *
 * Directly under (site), not (dashboard): that layout's own
 * `requireUser("/dashboard")` would send a signed-out visitor back to the
 * dashboard after sign-in instead of here (see /file-transfer).
 */
export const metadata: Metadata = { title: "Share feedback" };
export const dynamic = "force-dynamic";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  await requireUser("/feedback");
  const [groups, params] = await Promise.all([api.myFeedbackGroups(), searchParams]);
  const asked = params.group != null && /^-?\d+$/.test(params.group) ? Number(params.group) : null;
  const start = groups.some((g) => g.group_id === asked) ? asked : (groups[0]?.group_id ?? null);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-osrs-gold text-xl font-bold">Share feedback</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Tell us what&apos;s working and what isn&apos;t. We read every one of these.
        </p>
      </div>
      <FeedbackPage groups={groups} startGroupId={start} />
    </div>
  );
}
