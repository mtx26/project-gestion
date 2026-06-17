export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  projects: {
    all: ["projects"] as const,
    lists: () => ["projects", "list"] as const,
    list: (search?: string) => ["projects", "list", { search: search ?? "" }] as const,
    detail: (id: number) => ["projects", "detail", id] as const,
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
  permissions: {
    list: () => ["permissions", "list"] as const,
  },
  financialEntries: {
    list: (projectId: number) => ["projects", projectId, "financial-entries"] as const,
    chart: (projectId: number, groupBy: "day" | "month") =>
      ["projects", projectId, "financial-entries", "chart", groupBy] as const,
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
  },
  tasks: {
    list: (
      projectId: number,
      query: {
        folderId?: number;
        status?: string;
        priority?: string;
      } = {},
    ) =>
      ["projects", projectId, "tasks", {
        folder: query.folderId ?? "all",
        status: query.status ?? "all",
        priority: query.priority ?? "all",
      }] as const,
  },
  folders: {
    tree: (projectId: number, query: { includeTasks?: boolean } = {}) =>
      ["projects", projectId, "folders", "tree", { includeTasks: query.includeTasks ?? false }] as const,
    targetTree: (projectId: number) => ["projects", projectId, "folders", "target-tree"] as const,
  },
} as const;
