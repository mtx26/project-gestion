import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { PaginatedResponse, Task, TaskPayload } from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

interface TaskListFilters {
  search?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assignedTo?: number;
  folderId?: number;
  ordering?: string;
}

export function useTasks(projectId: number | null, filters: TaskListFilters = {}) {
  const query = useQuery({
    queryKey: projectId
      ? queryKeys.tasks.list(projectId, {
          search: filters.search || undefined,
          status: filters.status,
          priority: filters.priority,
          assignedTo: filters.assignedTo,
          folderId: filters.folderId,
          excludeDone: filters.status ? undefined : true,
        })
      : queryKeys.disabled(),
    queryFn: () =>
      api.tasks.list(projectId!, {
        search: filters.search || undefined,
        status: filters.status,
        priority: filters.priority,
        assigned_to: filters.assignedTo,
        folder: filters.folderId,
        exclude_done: filters.status ? undefined : true,
      }),
    enabled: Boolean(projectId),
  });

  return { ...query, tasks: normalizeApiList(query.data) };
}

/** Paginated variant backing the main list — loads more pages as the user
 * scrolls instead of web's page-number buttons (native list convention). */
export function useTasksInfinite(projectId: number | null, filters: TaskListFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: projectId
      ? [
          ...queryKeys.tasks.list(projectId, {
            search: filters.search || undefined,
            status: filters.status,
            priority: filters.priority,
            assignedTo: filters.assignedTo,
            folderId: filters.folderId,
            ordering: filters.ordering,
            excludeDone: filters.status ? undefined : true,
          }),
          "infinite",
        ]
      : queryKeys.disabled(),
    queryFn: ({ pageParam }) =>
      api.tasks.list(projectId!, {
        search: filters.search || undefined,
        status: filters.status,
        priority: filters.priority,
        assigned_to: filters.assignedTo,
        folder: filters.folderId,
        ordering: filters.ordering,
        exclude_done: filters.status ? undefined : true,
        page: pageParam,
      }),
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

  return { ...query, tasks };
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
