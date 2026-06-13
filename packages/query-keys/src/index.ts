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
} as const;

