import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { parseEnumParam } from "@/lib/url-params";

export type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

const REQUEST_STATUS_VALUES = ["all", "pending", "approved", "rejected"] as const;


export function parseStatusFilter(value: string | null): RequestStatusFilter {
  return parseEnumParam(value, REQUEST_STATUS_VALUES, "all");
}

export async function invalidateExpenseRequests(queryClient: QueryClient, projectId: number): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId) });
}

