import { RotateCcw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { DateFilterPill } from "../../../components/filters/DateFilterPill";
import { FilterPill } from "../../../components/filters/FilterPill";
import { TogglePill } from "../../../components/filters/TogglePill";
import { theme } from "../../../theme";

interface RequestFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  statusLabel: string;
  onPickStatus: () => void;
  requestedByLabel: string;
  onPickRequestedBy: () => void;
  folderLabel: string;
  onPickFolder: () => void;
  dateFrom: string | undefined;
  onDateFromChange: (value: string | undefined) => void;
  dateTo: string | undefined;
  onDateToChange: (value: string | undefined) => void;
  showRejectedDisplay: boolean;
  onToggleShowRejected: () => void;
  onReset: () => void;
}

/** Secondary request filters, presented as a bottom sheet — mirrors
 * TaskFilterSheet's shape (status, requested-by, folder, date range,
 * include-rejected). Search stays outside, in the screen's header. */
export function RequestFilterSheet({
  visible,
  onClose,
  statusLabel,
  onPickStatus,
  requestedByLabel,
  onPickRequestedBy,
  folderLabel,
  onPickFolder,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  showRejectedDisplay,
  onToggleShowRejected,
  onReset,
}: RequestFilterSheetProps) {
  return (
    <BottomSheet visible={visible} title="Filtres" onClose={onClose}>
      <View className="flex-row flex-wrap items-center gap-2">
        <FilterPill label={statusLabel} onPress={onPickStatus} />
        <FilterPill label={`Demande par : ${requestedByLabel}`} onPress={onPickRequestedBy} />
        <FilterPill label={`Dossier : ${folderLabel}`} onPress={onPickFolder} />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <DateFilterPill label="Du" value={dateFrom} onChange={onDateFromChange} />
        <DateFilterPill label="Au" value={dateTo} onChange={onDateToChange} />
        <TogglePill label="Inclure refusees" active={showRejectedDisplay} onPress={onToggleShowRejected} />
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
