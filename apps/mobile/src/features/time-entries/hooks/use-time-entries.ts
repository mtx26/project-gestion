import {
  buildTimeEntriesListQuery,
  getApiCount,
  normalizeApiList,
  type TimeEntryListFilters,
  type TimeEntryScopeQuery,
} from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type {
  PaginatedResponse,
  TimeEntry,
  TimeEntryBulkPaymentPayload,
  TimeEntryPayload,
} from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Un paiement cree aussi une entree financiere (main d'oeuvre) cote serveur :
 * les deux listes doivent etre rechargees, sinon la page Finances reste perimee. */
function usePaymentInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
  };
}

/** Variante paginee qui alimente la liste principale — charge les pages suivantes
 * au scroll plutot qu'avec les boutons de pagination du web (convention native). */
export function useTimeEntriesInfinite(
  projectId: number | null,
  filters: TimeEntryListFilters = {},
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: projectId
      ? [...buildTimeEntriesListQuery(api, projectId, filters).queryKey, "infinite"]
      : queryKeys.disabled(),
    queryFn: ({ pageParam }) => buildTimeEntriesListQuery(api, projectId!, filters, pageParam).queryFn(),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (Array.isArray(lastPage)) {
        return undefined;
      }
      return (lastPage as PaginatedResponse<TimeEntry>).next ? allPages.length + 1 : undefined;
    },
    enabled: Boolean(projectId) && enabled,
  });

  const entries = (query.data?.pages ?? []).flatMap((page) => normalizeApiList(page));
  // Total renvoye par l'enveloppe de pagination du backend, pas seulement ce qui a
  // ete scrolle : le compte de la premiere page fait foi, il ne bouge pas quand les
  // suivantes arrivent.
  const count = getApiCount(query.data?.pages?.[0]);

  return { ...query, entries, count };
}

export function useTimeEntry(projectId: number | null, timeEntryId: number | null) {
  return useQuery({
    queryKey: projectId && timeEntryId ? queryKeys.timeEntries.detail(projectId, timeEntryId) : queryKeys.disabled(),
    queryFn: () => api.timeEntries.get(projectId!, timeEntryId!),
    enabled: Boolean(projectId && timeEntryId),
  });
}

/** Synthese du scope courant (memes filtres que la liste, `search` en moins qu'elle
 * ignore) : totaux et repartition par membre, qui bornent aussi le paiement groupe. */
export function useTimeEntryStats(projectId: number | null, scope: TimeEntryScopeQuery, enabled = true) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.timeEntries.stats(projectId, {
          userId: scope.user ?? "all",
          startDate: scope.start_date,
          endDate: scope.end_date,
          paymentStatus: scope.payment_status,
          target: scope.target,
        })
      : queryKeys.disabled(),
    queryFn: () => api.timeEntries.stats(projectId!, scope),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useCreateTimeEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TimeEntryPayload) => api.timeEntries.create(projectId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId!) }),
  });
}

export function useUpdateTimeEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TimeEntryPayload> }) =>
      api.timeEntries.update(projectId!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId!) }),
  });
}

export function useDeleteTimeEntry(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.timeEntries.remove(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId!) }),
  });
}

export function usePayTimeEntry(projectId: number | null) {
  const invalidate = usePaymentInvalidation(projectId);

  return useMutation({
    mutationFn: ({ id, mode, amount }: { id: number; mode: "full" | "partial"; amount: string }) =>
      api.timeEntries.pay(projectId!, id, {
        pay_full: mode === "full",
        amount: mode === "partial" ? amount : undefined,
      }),
    onSuccess: invalidate,
  });
}

export function useCorrectTimeEntryPayment(projectId: number | null) {
  const invalidate = usePaymentInvalidation(projectId);

  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      api.timeEntries.correctPayment(projectId!, id, { amount }),
    onSuccess: invalidate,
  });
}

/** Paiement groupe : le montant est reparti cote serveur sur les entrees du scope
 * (memes filtres que la synthese), de la plus ancienne a la plus recente. */
export function useBulkPayTimeEntries(projectId: number | null, scope: TimeEntryScopeQuery) {
  const invalidate = usePaymentInvalidation(projectId);

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: TimeEntryBulkPaymentPayload }) =>
      api.timeEntries.bulkPay(projectId!, { ...scope, user: userId }, payload),
    onSuccess: invalidate,
    // Un refus vient le plus souvent d'un reste a payer perime (paiement concurrent,
    // filtres deplaces) : on recharge le scope pour que la feuille reaffiche les bons
    // montants avant que l'utilisateur ne retente.
    onError: invalidate,
  });
}
