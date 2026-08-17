import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import { FilterPill } from "../../../components/filters/FilterPill";
import { theme } from "../../../theme";

interface TaskFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  statusLabel: string;
  onPickStatus: () => void;
  priorityLabel: string;
  onPickPriority: () => void;
  assigneeLabel: string;
  onPickAssignee: () => void;
  createdByLabel: string;
  onPickCreatedBy: () => void;
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
  statusLabel,
  onPickStatus,
  priorityLabel,
  onPickPriority,
  assigneeLabel,
  onPickAssignee,
  createdByLabel,
  onPickCreatedBy,
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
      <View className="flex-row flex-wrap items-center gap-2">
        <FilterPill label={statusLabel} onPress={onPickStatus} />
        <FilterPill label={priorityLabel} onPress={onPickPriority} />
        <FilterPill label={`Assigne : ${assigneeLabel}`} onPress={onPickAssignee} />
        <FilterPill label={`Cree par : ${createdByLabel}`} onPress={onPickCreatedBy} />
        <FilterPill label={`Dossier : ${folderLabel}`} onPress={onPickFolder} />
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
