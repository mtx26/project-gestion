import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import {
  PressFilterRow,
  SelectFilterRow,
  type FilterRowConfig,
} from "../../../components/filters/SelectFilterRow";
import { theme } from "../../../theme";

interface TaskFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  status: FilterRowConfig;
  priority: FilterRowConfig;
  assignee: FilterRowConfig;
  createdBy: FilterRowConfig;
  folderLabel: string;
  onPickFolder: () => void;
  dateFrom: string | undefined;
  onDateFromChange: (value: string | undefined) => void;
  dateTo: string | undefined;
  onDateToChange: (value: string | undefined) => void;
  onReset: () => void;
}

/** Secondary task filters, presented as a bottom sheet — the mobile
 * equivalent of web's CollapsibleFilterBar contents (status, priority,
 * assignee, creator, folder, date range). Search and
 * sort stay outside, in the screen's always-visible header, matching web
 * where the primary search box also stays out of the Sheet. */
export function TaskFilterSheet({
  visible,
  onClose,
  status,
  priority,
  assignee,
  createdBy,
  folderLabel,
  onPickFolder,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
}: TaskFilterSheetProps) {
  return (
    <BottomSheet visible={visible} title="Filtres" onClose={onClose}>
      {/* Des lignes pleine largeur plutot que des puces : chaque filtre garde la
          place d'afficher sa valeur en entier, et la cible tactile fait 48pt. */}
      <View className="overflow-hidden rounded-md border border-border bg-background">
        <SelectFilterRow {...status} />
        <SelectFilterRow {...priority} />
        <SelectFilterRow {...assignee} />
        <SelectFilterRow {...createdBy} />
        {/* Le dossier ouvre un modal : c'est un arbre, pas une liste plate. */}
        <PressFilterRow label="Dossier" value={folderLabel} onPress={onPickFolder} isLast />
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
