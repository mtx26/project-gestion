import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { parseEnumParam } from "@/lib/url-params";

export async function invalidateFinancialEntries(queryClient: QueryClient, projectId: number): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId) });
}

const FINANCE_TYPE_VALUES = ["all", "expense", "refund"] as const;

export function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  return parseEnumParam(value, FINANCE_TYPE_VALUES, "all");
}
