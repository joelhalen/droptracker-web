import { Skeleton, SkeletonRows } from "@/components/ui";

export default function GroupAdminLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24" />
        ))}
      </div>
      <SkeletonRows rows={6} className="pt-2" />
    </div>
  );
}
