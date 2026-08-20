import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import { FilterPill } from "../../../components/filters/FilterPill";
import {
  SelectFilterPill,
  type SelectFilterPillProps,
} from "../../../components/filters/SelectFilterPill";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { theme } from "../../../theme";

interface FinanceFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  type: SelectFilterPillProps;
  source: SelectFilterPillProps;
  createdBy: SelectFilterPillProps;
  folderLabel: string;
  onPickFolder: () => void;
  ordering: SelectFilterPillProps;
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
  type,
  source,
  createdBy,
  folderLabel,
  onPickFolder,
  ordering,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
}: FinanceFilterSheetProps) {
  return (
    <BottomSheet visible={visible} title="Filtres" onClose={onClose}>
      <View className="flex-row flex-wrap items-center gap-2">
        <SelectFilterPill {...type} />
        <SelectFilterPill {...source} />
        <SelectFilterPill {...createdBy} />
        {/* Le dossier reste un modal : c'est un arbre, pas une liste plate. */}
        <FilterPill label={`Dossier : ${folderLabel}`} onPress={onPickFolder} />
        <SelectFilterPill {...ordering} />
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
