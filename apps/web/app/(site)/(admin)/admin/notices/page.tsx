import type { Metadata } from "next";
import { NoticesManager } from "@/components/admin/notices/notices-manager";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Pop-up notices" };
export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  await requireSuperadmin("/admin/notices");
  const [list, options] = await Promise.all([api.adminNotices(), api.adminNoticeOptions()]);
  return <NoticesManager initial={list} options={options} />;
}
