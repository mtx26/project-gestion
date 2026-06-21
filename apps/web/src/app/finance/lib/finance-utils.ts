import type { FinancialEntry } from "@project-gestion/types";
import { parseEnumParam } from "@/lib/url-params";

export const financeChartConfig = {
  expenses: { label: "Depenses", color: "var(--destructive)" },
  refunds: { label: "Remboursements", color: "oklch(0.6 0.15 150)" },
};

export function buildFinanceHref(projectId: number | string, searchParams?: { toString(): string }): string {
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("project", String(projectId));
  return `/finance?${params.toString()}`;
}

const FINANCE_TYPE_VALUES = ["all", "expense", "refund"] as const;

export function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  return parseEnumParam(value, FINANCE_TYPE_VALUES, "all");
}

export function computeTotals(entries: FinancialEntry[]): { expenses: number; refunds: number; balance: number } {
  let expenses = 0;
  let refunds = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    if (e.type === "expense") expenses += amount;
    else refunds += amount;
  }
  return { expenses, refunds, balance: refunds - expenses };
}

export function computeFinanceChartData(
  entries: FinancialEntry[],
): Array<{ period: string; expenses: number; refunds: number }> {
  const byMonth: Record<string, { period: string; expenses: number; refunds: number }> = {};
  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[period]) byMonth[period] = { period, expenses: 0, refunds: 0 };
    const amount = Number(entry.amount);
    if (entry.type === "expense") byMonth[period].expenses += amount;
    else byMonth[period].refunds += amount;
  }
  return Object.values(byMonth).sort((a, b) => a.period.localeCompare(b.period));
}

export function formatFinancePeriod(period: string): string {
  const [year, month] = period.split("-");
  if (year && month) {
    const names = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year.slice(2)}`;
  }
  return period;
}
