"use client";

import type { FinancialEntryChartSeriesPoint } from "@project-gestion/types";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/task-utils";
import { financeChartConfig, formatFinancePeriod } from "@/lib/finance-chart-utils";

function FinanceChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border/50 bg-background grid min-w-[9rem] gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{formatFinancePeriod(label ?? "")}</p>
      <div className="grid gap-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <div className="flex flex-1 items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {item.name === "expenses" ? "Depenses" : "Remboursements"}
              </span>
              <span className="font-mono font-medium tabular-nums">{formatMoney(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinanceBarChart({
  series,
  isLoading,
}: {
  series: FinancialEntryChartSeriesPoint[] | undefined;
  isLoading: boolean;
}) {
  const data = useMemo(
    () => (series ?? []).map((p) => ({ period: p.period, expenses: Number(p.expenses), refunds: Number(p.refunds) })),
    [series],
  );

  if (isLoading) return <Skeleton className="h-52 w-full rounded-lg" />;
  if (data.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <ChartContainer config={financeChartConfig} className="h-44 w-full">
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatFinancePeriod}
          />
          <ChartTooltip content={<FinanceChartTooltip />} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} maxBarSize={32} />
          <Bar dataKey="refunds" fill="var(--color-refunds)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-destructive" />
          Depenses
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "oklch(0.6 0.15 150)" }} />
          Remboursements
        </span>
      </div>
    </div>
  );
}
