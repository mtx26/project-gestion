import { parseEnumParam } from "@/lib/url-params";

export const financeChartConfig = {
  expenses: { label: "Depenses", color: "var(--destructive)" },
  refunds: { label: "Remboursements", color: "oklch(0.6 0.15 150)" },
};

const FINANCE_TYPE_VALUES = ["all", "expense", "refund"] as const;

export function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  return parseEnumParam(value, FINANCE_TYPE_VALUES, "all");
}

export function formatFinancePeriod(period: string): string {
  const [year, month] = period.split("-");
  if (year && month) {
    const names = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year.slice(2)}`;
  }
  return period;
}
