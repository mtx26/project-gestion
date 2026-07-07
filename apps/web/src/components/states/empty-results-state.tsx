import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** Empty state for a filtered list that legitimately has zero matches — distinct
 * from `NoProjectState` (no project selected) and `AccessDeniedState` (no permission). */
export function EmptyResultsState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
