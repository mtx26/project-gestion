import { SlidersHorizontal } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";

interface FilterTriggerProps {
  activeCount: number;
  onPress: () => void;
}

/** Opens a page's filter bottom sheet, with an active-filter count badge —
 * the mobile stand-in for web's CollapsibleFilterBar trigger button. */
export function FilterTrigger({ activeCount, onPress }: FilterTriggerProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Filtres"
      className="h-11 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3"
    >
      <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.foreground} />
      <Text className="text-sm font-medium text-foreground">Filtres</Text>
      {activeCount > 0 ? (
        <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-semibold text-primaryForeground">{activeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
