import { formatFinancePeriod } from "@project-gestion/domain";
import type { FinancialEntryChartSeriesPoint } from "@project-gestion/types";
import { Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { ENTRY_TYPE_ACCENTS } from "../../../components/badges/EntryTypeBadge";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";

/** Depenses et remboursements par mois, en barres groupees — equivalent natif du
 * graphique recharts du web. Sous deux points, la serie ne raconte rien : on ne
 * l'affiche pas (meme regle que web). */
export function FinanceBarChart({ series }: { series: FinancialEntryChartSeriesPoint[] | undefined }) {
  const points = series ?? [];
  if (points.length < 2) {
    return null;
  }

  // Barres groupees : deux entrees par periode, la premiere portant le libelle de
  // l'axe et un `spacing` reduit pour coller sa jumelle contre elle.
  const data = points.flatMap((point) => [
    {
      value: Number(point.expenses),
      label: formatFinancePeriod(point.period),
      spacing: 2,
      labelWidth: 40,
      frontColor: ENTRY_TYPE_ACCENTS.expense,
    },
    {
      value: Number(point.refunds),
      frontColor: ENTRY_TYPE_ACCENTS.refund,
    },
  ]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-4">
        <Legend color={ENTRY_TYPE_ACCENTS.expense} label="Depenses" />
        <Legend color={ENTRY_TYPE_ACCENTS.refund} label="Remboursements" />
      </View>
      <BarChart
        data={data}
        height={150}
        barWidth={12}
        spacing={18}
        initialSpacing={12}
        barBorderRadius={3}
        noOfSections={3}
        yAxisThickness={0}
        xAxisColor={theme.colors.border}
        rulesColor={theme.colors.border}
        yAxisTextStyle={{ color: theme.colors.muted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: theme.colors.muted, fontSize: 10 }}
        formatYLabel={(label: string) => formatMoney(Number(label))}
        yAxisLabelWidth={64}
        isAnimated
      />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: color }} className="h-2.5 w-2.5 rounded-sm" />
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
