import { formatDuration } from "@project-gestion/domain";
import type { TimeEntryUserStats } from "@project-gestion/types";
import { ChevronDown, ChevronUp, CreditCard } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";

interface TimeTotalsCardProps {
  label: string;
  totals: { durationMinutes: number; costAmount: number; remainingAmount: number };
  byUser: TimeEntryUserStats[];
  userNameById: Map<number, string>;
  currentUserId: number | null;
  /** Paiement groupe du "reste a payer" affiche ici — absent sans `time_entry.pay`. */
  onPay?: () => void;
}

/** Synthese du scope courant. Les trois totaux restent visibles en permanence ;
 * la repartition par membre et le paiement groupe se deplient au tap, pour ne pas
 * pousser la liste hors de l'ecran sur un telephone (le web, lui, a la place de
 * tout afficher dans une colonne laterale). */
export function TimeTotalsCard({
  label,
  totals,
  byUser,
  userNameById,
  currentUserId,
  onPay,
}: TimeTotalsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const userBreakdown = byUser
    .map((row) => ({
      name:
        row.user == null
          ? "Non attribue"
          : row.user === currentUserId
            ? "Toi"
            : (userNameById.get(row.user) ?? `Utilisateur ${row.user}`),
      minutes: row.duration_minutes,
      remainingAmount: Number(row.remaining_amount),
      isCurrentUser: row.user != null && row.user === currentUserId,
    }))
    .sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.name.localeCompare(b.name, "fr");
    });

  const hasDetails = userBreakdown.length > 0 || onPay != null;

  return (
    <View className="gap-3 rounded-md border border-border bg-surface p-4">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        disabled={!hasDetails}
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
        {hasDetails ? (
          expanded ? (
            <ChevronUp size={theme.iconSize.sm} color={theme.colors.muted} />
          ) : (
            <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
          )
        ) : null}
      </Pressable>

      <View className="flex-row gap-2">
        <TimeSummary label="Temps" value={formatDuration(totals.durationMinutes)} />
        <TimeSummary label="Montant" value={formatMoney(totals.costAmount)} />
        <TimeSummary label="Reste" value={formatMoney(totals.remainingAmount)} />
      </View>

      {expanded ? (
        <View className="gap-3">
          {onPay ? (
            <Pressable
              onPress={onPay}
              disabled={totals.remainingAmount <= 0}
              accessibilityRole="button"
              android_ripple={{ color: `${theme.colors.primaryForeground}33` }}
              className="h-11 flex-row items-center justify-center gap-2 rounded-md bg-primary"
              style={{ opacity: totals.remainingAmount <= 0 ? 0.5 : 1 }}
            >
              <CreditCard size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
              <Text className="text-sm font-semibold text-primaryForeground">Payer</Text>
            </Pressable>
          ) : null}

          {userBreakdown.length > 0 ? (
            <View className="gap-1.5 border-t border-border pt-3">
              {userBreakdown.map((row) => (
                <View key={row.name} className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text className="text-xs font-medium tabular-nums text-muted">
                    {formatDuration(row.minutes)} · {formatMoney(row.remainingAmount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TimeSummary({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-md border border-border bg-background p-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="mt-1 text-sm font-semibold tabular-nums text-foreground" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
