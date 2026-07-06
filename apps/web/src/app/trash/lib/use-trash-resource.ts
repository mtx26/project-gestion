"use client";

import type { PaginatedResponse } from "@project-gestion/types";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import { useCrudMutation } from "@/lib/use-crud-mutation";

/** One project-scoped trash resource (query + restore mutation), used to avoid
 * repeating the same useQuery/useMutation pair for every trashable entity. */
export function useTrashResource<T>({
  queryKey,
  queryFn,
  enabled,
  restoreFn,
  invalidateKeys,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<T[] | PaginatedResponse<T>>;
  enabled: boolean;
  restoreFn: (id: number) => Promise<unknown>;
  invalidateKeys: QueryKey[];
}) {
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    placeholderData: keepPreviousData,
  });

  const restore = useCrudMutation({
    mutationFn: restoreFn,
    invalidateKey: invalidateKeys,
    successMessage: "Element restaure",
  });

  return {
    items: normalizeApiList(query.data),
    count: getApiCount(query.data),
    pageSize: getApiPageSize(query.data),
    isLoading: query.isLoading,
    restore,
  };
}
