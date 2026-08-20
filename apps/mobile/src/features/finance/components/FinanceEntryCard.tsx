import { FINANCIAL_SOURCE_LABELS, getEntryTarget, getEntryTargetLabel } from "@project-gestion/domain";
import type { FinancialEntry } from "@project-gestion/types";
import { Folder, ListChecks, Paperclip } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { ENTRY_TYPE_ACCENTS, EntryTypeBadge } from "../../../components/badges/EntryTypeBadge";
import { formatDate } from "../../../lib/date-format";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";

/** Une ecriture financiere dans la liste. Le bord gauche colore distingue une
 * depense d'un remboursement, les actions vivent dans l'ecran de detail. */
export function FinanceEntryCard({ entry, onPress }: { entry: FinancialEntry; onPress: () => void }) {
  const target = getEntryTarget(entry);
  const TargetIcon = target?.type === "task" ? ListChecks : Folder;
  const documentCount = entry.documents_info?.length ?? 0;
  // Une ecriture de main d'oeuvre est un paiement fait *a* quelqu'un : c'est le
  // beneficiaire qui compte, pas l'auteur de la ligne.
  const personLabel = entry.time_entry_user_name
    ? `Pour ${entry.time_entry_user_name}`
    : (entry.created_by_name ?? "");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      style={{ borderLeftWidth: 4, borderLeftColor: ENTRY_TYPE_ACCENTS[entry.type] }}
      className="gap-2 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex-row items-center gap-2">
        <EntryTypeBadge type={entry.type} />
        <Text className="flex-1 text-base font-semibold tabular-nums text-foreground" numberOfLines={1}>
          {entry.type === "expense" ? "-" : "+"}
          {formatMoney(entry.amount)}
        </Text>
      </View>

      {entry.description ? (
        <Text className="text-sm text-foreground" numberOfLines={2}>
          {entry.description}
        </Text>
      ) : null}

      <Text className="text-xs text-muted" numberOfLines={1}>
        {[FINANCIAL_SOURCE_LABELS[entry.source], personLabel, formatDate(entry.created_at)]
          .filter(Boolean)
          .join(" · ")}
      </Text>

      <View className="flex-row items-center gap-3">
        {target ? (
          <View className="flex-1 flex-row items-center gap-1.5">
            <TargetIcon size={12} color={theme.colors.muted} />
            <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
              {getEntryTargetLabel(entry)}
            </Text>
          </View>
        ) : null}
        {documentCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Paperclip size={12} color={theme.colors.muted} />
            <Text className="text-xs text-muted">{documentCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
