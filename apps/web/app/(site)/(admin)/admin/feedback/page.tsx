import type { Metadata } from "next";
import { FeedbackManager } from "@/components/admin/feedback/feedback-manager";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireSuperadmin("/admin/feedback");
  const [overview, options] = await Promise.all([api.adminFeedback(), api.adminNoticeOptions()]);
  return <FeedbackManager initial={overview} options={options} />;
}
