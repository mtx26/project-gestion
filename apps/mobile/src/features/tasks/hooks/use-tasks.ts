import { buildTasksListQuery, getApiCount, normalizeApiList, type TaskListFilters } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { PaginatedResponse, Task, TaskPayload } from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export function useTasks(projectId: number | null, filters: TaskListFilters = {}) {
  const query = useQuery({
    queryKey: projectId ? buildTasksListQuery(api, projectId, filters).queryKey : queryKeys.disabled(),
    queryFn: () => buildTasksListQuery(api, projectId!, filters).queryFn(),
    enabled: Boolean(projectId),
  });

  return { ...query, tasks: normalizeApiList(query.data), count: getApiCount(query.data) };
}

/** Paginated variant backing the main list — loads more pages as the user
 * scrolls instead of web's page-number buttons (native list convention). */
export function useTasksInfinite(projectId: number | null, filters: TaskListFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: projectId
      ? [...buildTasksListQuery(api, projectId, filters).queryKey, "infinite"]
      : queryKeys.disabled(),
    queryFn: ({ pageParam }) => buildTasksListQuery(api, projectId!, filters, pageParam).queryFn(),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (Array.isArray(lastPage)) {
        return undefined;
      }
      return (lastPage as PaginatedResponse<Task>).next ? allPages.length + 1 : undefined;
    },
    enabled: Boolean(projectId),
  });

  const tasks = (query.data?.pages ?? []).flatMap((page) => normalizeApiList(page));
  // Total match count from the backend's pagination envelope, not just what's
  // been scrolled into view so far — the first page's count is authoritative
  // since it doesn't change as later pages load.
  const count = getApiCount(query.data?.pages?.[0]);

  return { ...query, tasks, count };
}

export function useTask(projectId: number | null, taskId: number | null) {
  return useQuery({
    queryKey: projectId && taskId ? queryKeys.tasks.detail(projectId, taskId) : queryKeys.disabled(),
    queryFn: () => api.tasks.get(projectId!, taskId!),
    enabled: Boolean(projectId && taskId),
  });
}

export function useCreateTask(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TaskPayload) => api.tasks.create(projectId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) }),
  });
}

export function useUpdateTask(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      api.tasks.update(projectId!, taskId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) }),
  });
}

export function useDeleteTask(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => api.tasks.remove(projectId!, taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) }),
  });
}
