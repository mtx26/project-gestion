import { queryKeys } from "@project-gestion/query-keys";
import type {
  ExpenseRequest,
  FinancialEntry,
  FolderTreeNode,
  Notification,
  PaginatedResponse,
  Project,
  ProjectMember,
  Task,
  TimeEntry,
} from "@project-gestion/types";

/** The minimal slice of the API client these builders call. Kept as a local
 * structural type (not the real `ApiClient` from "./index") so this file has
 * no import cycle back into the package's own barrel, which re-exports it —
 * any real `ApiClient` already satisfies this shape, so callers just pass
 * their app's `api` object as-is. */
interface QueryBuilderApiClient {
  projects: {
    list: () => Promise<Project[] | PaginatedResponse<Project>>;
  };
  members: {
    list: (projectId: number) => Promise<ProjectMember[] | PaginatedResponse<ProjectMember>>;
  };
  folders: {
    tree: (
      projectId: number,
      query?: { includeTasks?: boolean; includeFiles?: boolean },
    ) => Promise<FolderTreeNode[]>;
  };
  tasks: {
    list: (
      projectId: number,
      query?: {
        folder?: number;
        status?: Task["status"];
        priority?: Task["priority"];
        created_by?: number;
        assigned_to?: number;
        exclude_done?: boolean;
        date_from?: string;
        date_to?: string;
        page?: number;
        ordering?: string;
        search?: string;
      },
    ) => Promise<Task[] | PaginatedResponse<Task>>;
  };
  financialEntries: {
    list: (
      projectId: number,
      query?: {
        type?: string;
        source?: "manual" | "labor";
        folder?: number;
        created_by?: number;
        ordering?: string;
        page?: number;
        search?: string;
        date_from?: string;
        date_to?: string;
      },
    ) => Promise<FinancialEntry[] | PaginatedResponse<FinancialEntry>>;
  };
  timeEntries: {
    list: (
      projectId: number,
      query?: {
        user?: number;
        start_date?: string;
        end_date?: string;
        include_paid?: boolean;
        payment_status?: string;
        target?: string;
        search?: string;
        page?: number;
      },
    ) => Promise<TimeEntry[] | PaginatedResponse<TimeEntry>>;
  };
  expenseRequests: {
    list: (
      projectId: number,
      query?: {
        status?: string;
        folder?: number;
        requested_by?: number;
        exclude_rejected?: boolean;
        ordering?: string;
        page?: number;
        search?: string;
        date_from?: string;
        date_to?: string;
      },
    ) => Promise<ExpenseRequest[] | PaginatedResponse<ExpenseRequest>>;
  };
  notifications: {
    list: (query?: { unread?: boolean; page?: number }) => Promise<Notification[] | PaginatedResponse<Notification>>;
  };
}

/** Pure `{ queryKey, queryFn }` builders — no hooks, no React Query import.
 * Each app wraps these in its own `useQuery`/`useInfiniteQuery` locally (web
 * reads filters from the URL, mobile from local/route state); this is just
 * the part that was identical either way: turning a filters object into the
 * right `queryKeys.*` key and `api.*` call. */

export function buildProjectsListQuery(api: QueryBuilderApiClient) {
  return {
    queryKey: queryKeys.projects.lists(),
    queryFn: () => api.projects.list(),
  };
}

export function buildProjectMembersQuery(api: QueryBuilderApiClient, projectId: number) {
  return {
    queryKey: queryKeys.members.list(projectId),
    queryFn: () => api.members.list(projectId),
  };
}

export function buildProjectFoldersQuery(api: QueryBuilderApiClient, projectId: number) {
  return {
    queryKey: queryKeys.folders.tree(projectId, { includeFiles: false }),
    queryFn: () => api.folders.tree(projectId, { includeFiles: false }),
  };
}

export interface TaskListFilters {
  search?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  assignedTo?: number;
  createdBy?: number;
  folderId?: number;
  dateFrom?: string;
  dateTo?: string;
  includeCompleted?: boolean;
  ordering?: string;
}

/** `page` is a separate argument (not part of `filters`) because the two
 * callers page differently: web passes its own page-number state here on
 * every render, mobile's infinite-scroll variant calls this once per page
 * with React Query's own `pageParam`, and mobile's plain list view never
 * passes one at all. */
export function buildTasksListQuery(
  api: QueryBuilderApiClient,
  projectId: number,
  filters: TaskListFilters = {},
  page?: number,
) {
  // Same default as web: exclude done tasks unless the caller explicitly
  // asked to include them, or is already filtering to a specific status.
  const excludeDone = filters.includeCompleted || filters.status ? undefined : true;

  return {
    queryKey: queryKeys.tasks.list(projectId, {
      search: filters.search || undefined,
      status: filters.status,
      priority: filters.priority,
      assignedTo: filters.assignedTo,
      createdBy: filters.createdBy,
      folderId: filters.folderId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      excludeDone,
      ordering: filters.ordering,
      page,
    }),
    queryFn: () =>
      api.tasks.list(projectId, {
        search: filters.search || undefined,
        status: filters.status,
        priority: filters.priority,
        assigned_to: filters.assignedTo,
        created_by: filters.createdBy,
        folder: filters.folderId,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        exclude_done: excludeDone,
        ordering: filters.ordering,
        page,
      }),
  };
}

// The four builders below back finance/time/requests/notifications, which
// only exist on web today — mobile's equivalent screens are still
// placeholders (see apps/mobile/src/features/{finance,time-entries,requests,
// notifications}). Extracted now anyway so mobile's future hooks just import
// these instead of re-deriving the same filter→key/queryFn mapping web
// already got right.

export interface FinanceEntryListFilters {
  search?: string;
  type?: string;
  source?: "manual" | "labor";
  createdBy?: number;
  folderId?: number;
  dateFrom?: string;
  dateTo?: string;
  ordering?: string;
}

export function buildFinanceEntriesListQuery(
  api: QueryBuilderApiClient,
  projectId: number,
  filters: FinanceEntryListFilters = {},
  page?: number,
) {
  return {
    queryKey: queryKeys.financialEntries.list(projectId, {
      type: filters.type,
      source: filters.source,
      folder: filters.folderId,
      createdBy: filters.createdBy,
      ordering: filters.ordering,
      page,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    queryFn: () =>
      api.financialEntries.list(projectId, {
        search: filters.search || undefined,
        type: filters.type,
        source: filters.source,
        created_by: filters.createdBy,
        folder: filters.folderId,
        ordering: filters.ordering,
        page,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      }),
  };
}

export interface TimeEntryListFilters {
  userId?: number | "all";
  startDate?: string;
  endDate?: string;
  includePaid?: boolean;
  paymentStatus?: string;
  target?: string;
  search?: string;
}

export function buildTimeEntriesListQuery(
  api: QueryBuilderApiClient,
  projectId: number,
  filters: TimeEntryListFilters = {},
  page?: number,
) {
  return {
    queryKey: queryKeys.timeEntries.list(projectId, {
      userId: filters.userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      includePaid: filters.includePaid,
      paymentStatus: filters.paymentStatus,
      target: filters.target,
      search: filters.search,
      page,
    }),
    queryFn: () =>
      api.timeEntries.list(projectId, {
        ...(filters.userId == null || filters.userId === "all" ? {} : { user: filters.userId }),
        start_date: filters.startDate,
        end_date: filters.endDate,
        include_paid: filters.includePaid,
        payment_status: filters.paymentStatus,
        target: filters.target,
        search: filters.search || undefined,
        page,
      }),
  };
}

export interface ExpenseRequestListFilters {
  search?: string;
  status?: string;
  requestedBy?: number;
  folderId?: number;
  excludeRejected?: boolean;
  dateFrom?: string;
  dateTo?: string;
  ordering?: string;
}

export function buildExpenseRequestsListQuery(
  api: QueryBuilderApiClient,
  projectId: number,
  filters: ExpenseRequestListFilters = {},
  page?: number,
) {
  return {
    queryKey: queryKeys.expenseRequests.list(projectId, {
      status: filters.status,
      folder: filters.folderId,
      requestedBy: filters.requestedBy,
      excludeRejected: filters.excludeRejected,
      ordering: filters.ordering,
      page,
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    queryFn: () =>
      api.expenseRequests.list(projectId, {
        search: filters.search || undefined,
        status: filters.status,
        requested_by: filters.requestedBy,
        folder: filters.folderId,
        exclude_rejected: filters.excludeRejected || undefined,
        ordering: filters.ordering,
        page,
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
      }),
  };
}

/** Notifications aren't scoped to a project, unlike everything else here. */
export function buildNotificationsListQuery(api: QueryBuilderApiClient, unreadOnly: boolean, page?: number) {
  return {
    queryKey: queryKeys.notifications.list(unreadOnly, page),
    queryFn: () => api.notifications.list({ unread: unreadOnly || undefined, page }),
  };
}
