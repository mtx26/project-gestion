"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { buildFilterParams } from "@/lib/url-params";

export function useUrlFilter(
  path: string,
  searchParams: ReadonlyURLSearchParams,
  projectId: number | null,
) {
  const router = useRouter();
  return function updateUrlFilter(changes: Record<string, string | number | boolean | null | undefined>) {
    if (!projectId) return;
    const params = buildFilterParams(searchParams, projectId, changes);
    router.replace(`${path}?${params.toString()}`, { scroll: false });
  };
}
