import { parseEnumParam } from "@/lib/url-params";

export type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

const REQUEST_STATUS_VALUES = ["all", "pending", "approved", "rejected"] as const;

export function buildRequestsHref(projectId: number | string, searchParams?: { toString(): string }): string {
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("project", String(projectId));
  return `/requests?${params.toString()}`;
}

export function parseStatusFilter(value: string | null): RequestStatusFilter {
  return parseEnumParam(value, REQUEST_STATUS_VALUES, "all");
}

