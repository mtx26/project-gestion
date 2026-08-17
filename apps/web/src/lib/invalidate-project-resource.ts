import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Invalidates every cached query under a resource key — including sibling
 * aggregates (chart/calendar/stats) that share the same prefix, by design:
 * TanStack Query matches on key prefix, and refetching those is cheap enough
 * that a single, precise invalidation per resource beats tracking which
 * mutation might affect which aggregate. */
export function invalidateProjectResource(queryClient: QueryClient, key: QueryKey): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: key, refetchType: "all" });
}
