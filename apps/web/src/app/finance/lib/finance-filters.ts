import { parseEnumParam } from "@/lib/url-params";

const FINANCE_TYPE_VALUES = ["all", "expense", "refund"] as const;

export function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  return parseEnumParam(value, FINANCE_TYPE_VALUES, "all");
}

const FINANCE_SOURCE_VALUES = ["all", "manual", "labor"] as const;

export function parseSourceFilter(value: string | null): "all" | "manual" | "labor" {
  return parseEnumParam(value, FINANCE_SOURCE_VALUES, "all");
}
