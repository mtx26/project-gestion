import { ChevronDown } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { theme } from "../../theme";

interface FilterPillProps {
  label: string;
  onPress: () => void;
}

/** A single-choice filter chip that opens a picker (action sheet, modal...)
 * on tap. Reused across every list screen's filter sheet. */
export function FilterPill({ label, onPress }: FilterPillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-9 flex-row items-center gap-1 self-start rounded-full border border-border bg-surface px-3"
    >
      <Text className="text-xs font-medium text-foreground">{label}</Text>
      <ChevronDown size={12} color={theme.colors.muted} />
    </Pressable>
  );
}
