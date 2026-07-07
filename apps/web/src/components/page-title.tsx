import type { ReactNode } from "react";

export function PageTitle({ category, title }: { category: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{category}</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
    </div>
  );
}

/** Standard page header: `PageTitle` plus an optional right-aligned action
 * (e.g. a primary "create" button), stacked on mobile and side-by-side on `sm+`. */
export function PageHeader({
  category,
  title,
  children,
}: {
  category: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <PageTitle category={category} title={title} />
      {children}
    </div>
  );
}
