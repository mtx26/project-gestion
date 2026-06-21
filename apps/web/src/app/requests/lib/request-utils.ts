export type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

export function buildRequestsHref(projectId: number | string): string {
  return `/requests?project=${projectId}`;
}

export function parseStatusFilter(value: string | null): RequestStatusFilter {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "all";
}
