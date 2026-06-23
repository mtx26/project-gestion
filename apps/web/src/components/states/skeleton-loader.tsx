import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonLoader({
  count,
  className = "h-14 w-full rounded-lg",
}: {
  count: number;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
