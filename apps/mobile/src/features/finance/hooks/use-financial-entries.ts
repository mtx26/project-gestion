import {
  buildFinanceEntriesListQuery,
  getApiCount,
  normalizeApiList,
  type FinanceEntryListFilters,
} from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { FinancialEntry, FinancialEntryPayload, PaginatedResponse } from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Variante paginee qui alimente la liste principale — charge les pages suivantes au
 * scroll plutot qu'avec les boutons de pagination du web (convention native). */
export function useFinancialEntriesInfinite(
  projectId: number | null,
  filters: FinanceEntryListFilters = {},
) {
  const query = useInfiniteQuery({
    queryKey: projectId
      ? [...buildFinanceEntriesListQuery(api, projectId, filters).queryKey, "infinite"]
      : queryKeys.disabled(),
    queryFn: ({ pageParam }) => buildFinanceEntriesListQuery(api, projectId!, filters, pageParam).queryFn(),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (Array.isArray(lastPage)) {
        return undefined;
      }
      return (lastPage as PaginatedResponse<FinancialEntry>).next ? allPages.length + 1 : undefined;
    },
    enabled: Boolean(projectId),
  });

  const entries = (query.data?.pages ?? []).flatMap((page) => normalizeApiList(page));
  const count = getApiCount(query.data?.pages?.[0]);

  return { ...query, entries, count };
}

export function useFinancialEntry(projectId: number | null, entryId: number | null) {
  return useQuery({
    queryKey: projectId && entryId ? queryKeys.financialEntries.detail(projectId, entryId) : queryKeys.disabled(),
    queryFn: () => api.financialEntries.get(projectId!, entryId!),
    enabled: Boolean(projectId && entryId),
  });
}

/** Totaux et serie mensuelle du graphique : meme endpoint que le web, borne par
 * defaut a l'annee en cours quand aucune periode n'est filtree. */
export function useFinanceChart(
  projectId: number | null,
  { startDate, endDate }: { startDate: string; endDate: string },
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.financialEntries.chart(projectId, "month", startDate, endDate)
      : queryKeys.disabled(),
    queryFn: () =>
      api.financialEntries.chart(projectId!, { group_by: "month", start_date: startDate, end_date: endDate }),
    enabled: Boolean(projectId),
  });
}

export function useCreateFinancialEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FinancialEntryPayload) => api.financialEntries.create(projectId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) }),
  });
}

export function useUpdateFinancialEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FinancialEntryPayload> }) =>
      api.financialEntries.update(projectId!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) }),
  });
}

export function useDeleteFinancialEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.financialEntries.remove(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) }),
  });
}
