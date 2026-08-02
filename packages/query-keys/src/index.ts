export const queryKeys = {
  /** Placeholder key for the `enabled: false` branch of a query — never fetched,
   * so every caller can share the same key instead of inventing a one-off literal. */
  disabled: () => ["disabled"] as const,
  projects: {
    all: ["projects"] as const,
    lists: () => ["projects", "list"] as const,
    list: (search?: string) => ["projects", "list", { search: search ?? "" }] as const,
    trash: () => ["projects", "trash"] as const,
  },
  members: {
    list: (projectId: number) => ["projects", projectId, "members"] as const,
  },
  roles: {
    list: (projectId: number) => ["projects", projectId, "roles"] as const,
  },
  invitations: {
    all: (projectId: number) => ["projects", projectId, "invitations"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly?: boolean, page?: number) =>
      ["notifications", "list", { unreadOnly: unreadOnly ?? false, page: page ?? 1 }] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  permissions: {
    list: () => ["permissions", "list"] as const,
  },
  financialEntries: {
    all: (projectId: number) => ["projects", projectId, "financial-entries"] as const,
    list: (projectId: number, query: { type?: string; source?: string; folder?: number; createdBy?: number; ordering?: string; page?: number; search?: string; dateFrom?: string; dateTo?: string } = {}) =>
      ["projects", projectId, "financial-entries", {
        type: query.type ?? "all",
        source: query.source ?? "all",
        folder: query.folder ?? "all",
        createdBy: query.createdBy ?? "all",
        ordering: query.ordering ?? "",
        page: query.page ?? 1,
        search: query.search ?? "",
        dateFrom: query.dateFrom ?? "",
        dateTo: query.dateTo ?? "",
      }] as const,
    chart: (projectId: number, groupBy: "day" | "month", startDate?: string, endDate?: string) =>
      ["projects", projectId, "financial-entries", "chart", groupBy, startDate ?? "", endDate ?? ""] as const,
    trash: (projectId: number, page = 1) => ["projects", projectId, "financial-entries", "trash", page] as const,
  },
  documents: {
    trash: (projectId: number, page = 1) => ["projects", projectId, "documents", "trash", page] as const,
    download: (projectId: number, documentId: number) =>
      ["projects", projectId, "documents", documentId, "download"] as const,
    downloadBatch: (projectId: number, documentIds: number[]) =>
      ["projects", projectId, "documents", "download-batch", [...documentIds].sort((a, b) => a - b)] as const,
  },
  expenseRequests: {
    all: (projectId: number) => ["projects", projectId, "expense-requests"] as const,
    detail: (projectId: number, id: number) => ["projects", projectId, "expense-requests", id] as const,
    list: (projectId: number, query: { status?: string; folder?: number; requestedBy?: number; excludeRejected?: boolean; ordering?: string; page?: number; search?: string; dateFrom?: string; dateTo?: string } = {}) =>
      ["projects", projectId, "expense-requests", {
        status: query.status ?? "all",
        folder: query.folder ?? "all",
        requestedBy: query.requestedBy ?? "all",
        excludeRejected: query.excludeRejected ?? false,
        ordering: query.ordering ?? "",
        page: query.page ?? 1,
        search: query.search ?? "",
        dateFrom: query.dateFrom ?? "",
        dateTo: query.dateTo ?? "",
      }] as const,
    trash: (projectId: number, page = 1) => ["projects", projectId, "expense-requests", "trash", page] as const,
  },
  tasks: {
    all: (projectId: number) => ["projects", projectId, "tasks"] as const,
    detail: (projectId: number, taskId: number) => ["projects", projectId, "tasks", taskId] as const,
    list: (
      projectId: number,
      query: {
        folderId?: number;
        status?: string;
        priority?: string;
        createdBy?: number;
        assignedTo?: number;
        excludeDone?: boolean;
        page?: number;
        ordering?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
      } = {},
    ) =>
      ["projects", projectId, "tasks", {
        folder: query.folderId ?? "all",
        status: query.status ?? "all",
        priority: query.priority ?? "all",
        createdBy: query.createdBy ?? "all",
        assignedTo: query.assignedTo ?? "all",
        excludeDone: query.excludeDone ?? false,
        page: query.page ?? 1,
        ordering: query.ordering ?? "",
        search: query.search ?? "",
        dateFrom: query.dateFrom ?? "",
        dateTo: query.dateTo ?? "",
      }] as const,
    trash: (projectId: number, page = 1) => ["projects", projectId, "tasks", "trash", page] as const,
  },
  folders: {
    allTree: (projectId: number) => ["projects", projectId, "folders", "tree"] as const,
    tree: (projectId: number, query: { includeTasks?: boolean; includeFiles?: boolean } = {}) =>
      ["projects", projectId, "folders", "tree", { includeTasks: query.includeTasks ?? false, includeFiles: query.includeFiles ?? true }] as const,
    targetTree: (projectId: number) => ["projects", projectId, "folders", "target-tree"] as const,
    trash: (projectId: number, page = 1) => ["projects", projectId, "folders", "trash", page] as const,
  },
  timeEntries: {
    all: (projectId: number) => ["projects", projectId, "time-entries"] as const,
    list: (
      projectId: number,
      query: {
        userId?: number | "all";
        startDate?: string;
        endDate?: string;
        includePaid?: boolean;
        paymentStatus?: string;
        target?: string;
        search?: string;
        page?: number;
      } = {},
    ) =>
      ["projects", projectId, "time-entries", {
        user: query.userId ?? "mine",
        startDate: query.startDate ?? "",
        endDate: query.endDate ?? "",
        includePaid: query.includePaid ?? false,
        paymentStatus: query.paymentStatus ?? "all",
        target: query.target ?? "",
        search: query.search ?? "",
        page: query.page ?? 1,
      }] as const,
    stats: (
      projectId: number,
      query: {
        userId?: number | "all";
        startDate?: string;
        endDate?: string;
        includePaid?: boolean;
        paymentStatus?: string;
        target?: string;
      } = {},
    ) =>
      ["projects", projectId, "time-entries", "stats", {
        user: query.userId ?? "all",
        startDate: query.startDate ?? "",
        endDate: query.endDate ?? "",
        includePaid: query.includePaid ?? false,
        paymentStatus: query.paymentStatus ?? "all",
        target: query.target ?? "",
      }] as const,
    trash: (projectId: number, page = 1) => ["projects", projectId, "time-entries", "trash", page] as const,
  },
  calendar: {
    get: (
      projectId: number,
      startDate: string,
      endDate: string,
      query: { includeTasks?: boolean; includeTime?: boolean } = {},
    ) =>
      ["projects", projectId, "calendar", {
        startDate,
        endDate,
        includeTasks: query.includeTasks ?? true,
        includeTime: query.includeTime ?? true,
      }] as const,
    subscription: (projectId: number) => ["projects", projectId, "calendar", "subscription"] as const,
  },
} as const;
