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
  permissions: {
    list: () => ["permissions", "list"] as const,
  },
  financialEntries: {
    list: (projectId: number) => ["projects", projectId, "financial-entries"] as const,
    chart: (projectId: number, groupBy: "day" | "month") =>
      ["projects", projectId, "financial-entries", "chart", groupBy] as const,
  },
  timeEntries: {
    list: (projectId: number) => ["projects", projectId, "time-entries"] as const,
  },
  folders: {
    tree: (projectId: number) => ["projects", projectId, "folders", "tree"] as const,
  },
} as const;
