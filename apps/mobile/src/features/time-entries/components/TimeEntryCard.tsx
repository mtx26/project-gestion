import {
  formatDuration,
  getEntryTarget,
  getEntryTargetLabel,
  getPaymentStatus,
} from "@project-gestion/domain";
import type { TimeEntry } from "@project-gestion/types";
import { Folder, ListChecks } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { PAYMENT_STATUS_ACCENTS, PaymentStatusBadge } from "../../../components/badges/PaymentStatusBadge";
import { formatDateTime } from "../../../lib/date-format";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";

/** Une entree de temps dans la liste. Le bord gauche colore reprend le statut de
 * paiement (comme les cartes du web), les actions vivent dans l'ecran de detail. */
export function TimeEntryCard({ entry, onPress }: { entry: TimeEntry; onPress: () => void }) {
  const paymentStatus = getPaymentStatus(entry);
  const target = getEntryTarget(entry);
  const TargetIcon = target?.type === "task" ? ListChecks : Folder;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      style={{ borderLeftWidth: 4, borderLeftColor: PAYMENT_STATUS_ACCENTS[paymentStatus] }}
      className="gap-2 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex-row items-center gap-2">
        <PaymentStatusBadge status={paymentStatus} />
        <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
          {entry.title || entry.description || "Temps enregistre"}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-semibold tabular-nums text-foreground">
          {formatDuration(entry.duration_minutes)}
        </Text>
        <Text className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(entry.cost_amount)}</Text>
      </View>

      <Text className="text-xs text-muted" numberOfLines={1}>
        {entry.user_display_name ?? "Non attribue"} · {formatDateTime(entry.start_date)}
      </Text>

      {target ? (
        <View className="flex-row items-center gap-1.5">
          <TargetIcon size={12} color={theme.colors.muted} />
          <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
            {getEntryTargetLabel(entry)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
