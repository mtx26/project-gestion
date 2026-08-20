import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import { FilterPill } from "../../../components/filters/FilterPill";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { theme } from "../../../theme";

interface FinanceFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  typeLabel: string;
  onPickType: () => void;
  sourceLabel: string;
  onPickSource: () => void;
  createdByLabel: string;
  onPickCreatedBy: () => void;
  folderLabel: string;
  onPickFolder: () => void;
  orderingLabel: string;
  onPickOrdering: () => void;
  dateFrom: string | undefined;
  onDateFromChange: (value: string | undefined) => void;
  dateTo: string | undefined;
  onDateToChange: (value: string | undefined) => void;
  onReset: () => void;
}

/** Filtres secondaires des finances, en bottom sheet — equivalent natif du contenu
 * de la CollapsibleFilterBar du web (type, origine, auteur, dossier, tri, periode).
 * La recherche reste dans l'en-tete toujours visible de l'ecran. */
export function FinanceFilterSheet({
  visible,
  onClose,
  typeLabel,
  onPickType,
  sourceLabel,
  onPickSource,
  createdByLabel,
  onPickCreatedBy,
  folderLabel,
  onPickFolder,
  orderingLabel,
  onPickOrdering,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
}: FinanceFilterSheetProps) {
  return (
    <BottomSheet visible={visible} title="Filtres" onClose={onClose}>
      <View className="flex-row flex-wrap items-center gap-2">
        <FilterPill label={typeLabel} onPress={onPickType} />
        <FilterPill label={sourceLabel} onPress={onPickSource} />
        <FilterPill label={`Cree par : ${createdByLabel}`} onPress={onPickCreatedBy} />
        <FilterPill label={`Dossier : ${folderLabel}`} onPress={onPickFolder} />
        <FilterPill label={`Tri : ${orderingLabel}`} onPress={onPickOrdering} />
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
