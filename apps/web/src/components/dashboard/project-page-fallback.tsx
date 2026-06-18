import { Skeleton } from "@/components/ui/skeleton";

export function ProjectPageFallback() {
  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r bg-sidebar p-4 text-sidebar-foreground lg:block">
        <div className="mb-10 flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="mb-3 h-4 w-16" />
        <Skeleton className="mb-8 h-10 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </aside>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-8 w-8" />
          <Skeleton className="mb-4 h-7 w-48" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}
