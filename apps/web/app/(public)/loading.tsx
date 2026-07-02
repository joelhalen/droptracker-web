import { Skeleton, SkeletonRows } from "@/components/ui";

export default function PublicLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <SkeletonRows rows={8} className="pt-4" />
    </div>
  );
}
