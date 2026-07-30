import {
  buildExpenseRequestsListQuery,
  getApiCount,
  normalizeApiList,
  type ExpenseRequestListFilters,
} from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { ExpenseRequestPayload } from "@project-gestion/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export function useRequests(projectId: number | null, filters: ExpenseRequestListFilters = {}) {
  const query = useQuery({
    queryKey: projectId ? buildExpenseRequestsListQuery(api, projectId, filters).queryKey : queryKeys.disabled(),
    queryFn: () => buildExpenseRequestsListQuery(api, projectId!, filters).queryFn(),
    enabled: Boolean(projectId),
  });

  return { ...query, requests: normalizeApiList(query.data), count: getApiCount(query.data) };
}

export function useRequest(projectId: number | null, requestId: number | null) {
  return useQuery({
    queryKey: projectId && requestId ? queryKeys.expenseRequests.detail(projectId, requestId) : queryKeys.disabled(),
    queryFn: () => api.expenseRequests.get(projectId!, requestId!),
    enabled: Boolean(projectId && requestId),
  });
}

export function useCreateRequest(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ExpenseRequestPayload) => api.expenseRequests.create(projectId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) }),
  });
}

export function useUpdateRequest(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) }),
  });
}

export function useDeleteRequest(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) }),
  });
}

export function useApproveRequest(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
    },
  });
}

export function useRejectRequest(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) }),
  });
}
