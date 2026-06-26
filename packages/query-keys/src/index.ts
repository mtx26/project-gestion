export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  projects: {
    all: ["projects"] as const,
    lists: () => ["projects", "list"] as const,
    list: (search?: string) => ["projects", "list", { search: search ?? "" }] as const,
    detail: (id: number) => ["projects", "detail", id] as const,
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
    list: (unreadOnly?: boolean) => ["notifications", "list", { unreadOnly: unreadOnly ?? false }] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  devices: {
    all: ["devices"] as const,
  },
  permissions: {
    list: () => ["permissions", "list"] as const,
  },
  financialEntries: {
    list: (projectId: number, query: { type?: string; folder?: number; createdBy?: number } = {}) =>
      ["projects", projectId, "financial-entries", {
        type: query.type ?? "all",
        folder: query.folder ?? "all",
        createdBy: query.createdBy ?? "all",
      }] as const,
    chart: (projectId: number, groupBy: "day" | "month") =>
      ["projects", projectId, "financial-entries", "chart", groupBy] as const,
    trash: (projectId: number) => ["projects", projectId, "financial-entries", "trash"] as const,
  },
  documents: {
    list: (projectId: number) => ["projects", projectId, "documents"] as const,
    trash: (projectId: number) => ["projects", projectId, "documents", "trash"] as const,
  },
  expenseRequests: {
    list: (projectId: number, query: { status?: string; folder?: number; requestedBy?: number } = {}) =>
      ["projects", projectId, "expense-requests", {
        status: query.status ?? "all",
        folder: query.folder ?? "all",
        requestedBy: query.requestedBy ?? "all",
      }] as const,
    trash: (projectId: number) => ["projects", projectId, "expense-requests", "trash"] as const,
  },
  tasks: {
    list: (
      projectId: number,
      query: {
        folderId?: number;
        status?: string;
        priority?: string;
        createdBy?: number;
      } = {},
    ) =>
      ["projects", projectId, "tasks", {
        folder: query.folderId ?? "all",
        status: query.status ?? "all",
        priority: query.priority ?? "all",
        createdBy: query.createdBy ?? "all",
      }] as const,
    trash: (projectId: number) => ["projects", projectId, "tasks", "trash"] as const,
  },
  folders: {
    tree: (projectId: number, query: { includeTasks?: boolean } = {}) =>
      ["projects", projectId, "folders", "tree", { includeTasks: query.includeTasks ?? false }] as const,
    targetTree: (projectId: number) => ["projects", projectId, "folders", "target-tree"] as const,
    trash: (projectId: number) => ["projects", projectId, "folders", "trash"] as const,
  },
  timeEntries: {
    list: (
      projectId: number,
      query: {
        userId?: number | "all";
        startDate?: string;
        endDate?: string;
        includeUnpaid?: boolean;
      } = {},
    ) =>
      ["projects", projectId, "time-entries", {
        user: query.userId ?? "mine",
        startDate: query.startDate ?? "",
        endDate: query.endDate ?? "",
        includeUnpaid: query.includeUnpaid ?? false,
      }] as const,
    trash: (projectId: number) => ["projects", projectId, "time-entries", "trash"] as const,
  },
} as const;
