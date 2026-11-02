import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { RecapDesigner } from "@/components/recap-designer";

export const metadata: Metadata = { title: "Recap designer" };

type Params = Promise<{ id: string }>;
type Search = Promise<{ period?: string }>;

function lastMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The recap designer (web154a, suggestion #224). Access is gated by the
 * (admin)/groups/[id] layout; the review DM a clan's admins get links here
 * with `?period=` set to the month that is waiting.
 */
export default async function GroupRecapsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  const index = await api.recapIndex("group", groupId);
  const months = (index?.periods ?? []).filter((p) => p.kind === "month").map((p) => p.period);
  const { period: asked } = await searchParams;
  const period = asked && /^\d{4}-\d{2}$/.test(asked) ? asked : (months[0] ?? lastMonth());
  // The preview needs a card: this month's if it exists, else the newest one.
  const previewPeriod = months.includes(period) ? period : (months[0] ?? null);

  const [monthState, defaultState, recap, group] = await Promise.all([
    api.recapDesignAdmin(groupId, period),
    api.recapDesignAdmin(groupId, ""),
    previewPeriod ? api.recap("group", groupId, previewPeriod, true) : null,
    api.group(groupId).catch(() => null),
  ]);

  return (
    <RecapDesigner
      key={period}
      groupId={groupId}
      groupName={group?.name ?? `Group ${groupId}`}
      period={period}
      months={months.length ? months : [period]}
      previewPeriod={previewPeriod}
      recap={recap}
      monthState={monthState}
      defaultState={defaultState}
    />
  );
}
