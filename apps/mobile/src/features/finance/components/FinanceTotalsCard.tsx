import type { FinancialEntryChart } from "@project-gestion/types";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ENTRY_TYPE_ACCENTS } from "../../../components/badges/EntryTypeBadge";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";
import { FinanceBarChart } from "./FinanceBarChart";

interface FinanceTotalsCardProps {
  label: string;
  chart: FinancialEntryChart | undefined;
}

/** Synthese financiere du scope courant. Les trois totaux restent visibles ; le
 * graphique mensuel se deplie au tap, pour ne pas pousser la liste hors de l'ecran
 * (le web, lui, a la place de tout afficher l'un sous l'autre). */
export function FinanceTotalsCard({ label, chart }: FinanceTotalsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const expenses = Number(chart?.totals.expenses ?? 0);
  const refunds = Number(chart?.totals.refunds ?? 0);
  const balance = Number(chart?.totals.balance ?? 0);
  const hasChart = (chart?.series?.length ?? 0) >= 2;

  return (
    <View className="gap-3 rounded-md border border-border bg-surface p-4">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        disabled={!hasChart}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between gap-2"
      >
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase text-muted" numberOfLines={1}>
            {label}
          </Text>
          <Text className="mt-0.5 text-base font-semibold text-foreground">Synthese</Text>
        </View>
        {hasChart ? (
          expanded ? (
            <ChevronUp size={theme.iconSize.sm} color={theme.colors.muted} />
          ) : (
            <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
          )
        ) : null}
      </Pressable>

      <View className="flex-row gap-2">
        <FinanceSummary label="Depenses" value={formatMoney(expenses)} color={ENTRY_TYPE_ACCENTS.expense} />
        <FinanceSummary label="Rembours." value={formatMoney(refunds)} color={ENTRY_TYPE_ACCENTS.refund} />
        <FinanceSummary
          label="Net"
          value={formatMoney(balance)}
          color={balance >= 0 ? ENTRY_TYPE_ACCENTS.refund : ENTRY_TYPE_ACCENTS.expense}
        />
      </View>

      {expanded ? <FinanceBarChart series={chart?.series} /> : null}
    </View>
  );
}

function FinanceSummary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1 rounded-md border border-border bg-background p-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text
        style={{ color }}
        className="mt-1 text-sm font-semibold tabular-nums"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}
