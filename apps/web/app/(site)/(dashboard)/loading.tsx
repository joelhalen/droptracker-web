import { Skeleton, SkeletonRows } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <SkeletonRows rows={5} />
    </div>
  );
}
