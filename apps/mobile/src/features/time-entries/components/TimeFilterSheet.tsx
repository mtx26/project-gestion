import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import {
  PressFilterRow,
  SelectFilterRow,
  type FilterRowConfig,
} from "../../../components/filters/SelectFilterRow";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { theme } from "../../../theme";

interface TimeFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  paymentStatus: FilterRowConfig;
  /** Absent sans `time_entry.view_all` : on ne voit alors que ses propres heures. */
  user?: FilterRowConfig;
  targetLabel: string;
  onPickTarget: () => void;
  dateFrom: string | undefined;
  onDateFromChange: (value: string | undefined) => void;
  dateTo: string | undefined;
  onDateToChange: (value: string | undefined) => void;
  onReset: () => void;
}

/** Filtres secondaires du suivi du temps, en bottom sheet — equivalent natif du
 * contenu de la CollapsibleFilterBar du web (statut de paiement, membre, cible,
 * periode). La recherche reste dans l'en-tete toujours visible de l'ecran. */
export function TimeFilterSheet({
  visible,
  onClose,
  paymentStatus,
  user,
  targetLabel,
  onPickTarget,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
}: TimeFilterSheetProps) {
  return (
    <BottomSheet visible={visible} title="Filtres" onClose={onClose}>
      <View className="overflow-hidden rounded-md border border-border bg-background">
        <SelectFilterRow {...paymentStatus} />
        {user ? <SelectFilterRow {...user} /> : null}
        {/* La cible ouvre un modal : c'est un arbre, pas une liste plate. */}
        <PressFilterRow label="Cible" value={targetLabel} onPress={onPickTarget} isLast />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <DateFilterPill label="Du" value={dateFrom} onChange={onDateFromChange} />
        <DateFilterPill label="Au" value={dateTo} onChange={onDateToChange} />
      </View>

      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        className="h-11 flex-row items-center justify-center gap-2 rounded-md border border-danger/30 bg-danger/10"
      >
        <RotateCcw size={theme.iconSize.sm} color={theme.colors.danger} />
        <Text className="text-sm font-medium text-danger">Reinitialiser les filtres</Text>
      </Pressable>
    </BottomSheet>
  );
}
