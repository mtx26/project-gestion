import { Check } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { theme } from "../../theme";

interface TogglePillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

/** An on/off filter chip (e.g. "Inclure terminees") — the native stand-in for
 * web's FilterToggle. `active` is a display state the caller controls, so it
 * can be derived from more than just its own on/off flag when needed. */
export function TogglePill({ label, active, onPress }: TogglePillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-9 flex-row items-center gap-1 self-start rounded-full border px-3 ${
        active ? "border-primary bg-primary/10" : "border-border bg-surface"
      }`}
    >
      {active ? <Check size={12} color={theme.colors.primary} /> : null}
      <Text className={`text-xs font-medium ${active ? "text-primary" : "text-foreground"}`}>{label}</Text>
    </Pressable>
  );
}
