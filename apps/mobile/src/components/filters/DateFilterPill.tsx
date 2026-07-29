import DateTimePicker from "@react-native-community/datetimepicker";
import { ChevronDown, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { formatDate } from "../../lib/date-format";
import { theme } from "../../theme";

interface DateFilterPillProps {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** Date-only filter chip: shows "Label : jj/mm/aaaa" (or "-" when unset).
 * Tapping it reveals the real native date picker in place — the compact
 * widget on iOS (its own popover), a dialog on Android. Reused by every list
 * screen with a date-range filter (web's FilterPeriodPicker equivalent). */
export function DateFilterPill({ label, value, onChange }: DateFilterPillProps) {
  const [revealed, setRevealed] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const hasValue = Boolean(value);
  const dateValue = hasValue ? new Date(value as string) : new Date();

  function handleChange(event: { type: string }, selectedDate?: Date) {
    setShowAndroidPicker(false);
    if (event.type === "set" && selectedDate) {
      onChange(selectedDate.toISOString().slice(0, 10));
    }
  }

  const showCompactPicker = Platform.OS === "ios" && (revealed || hasValue);

  if (showCompactPicker) {
    return (
      <View className="h-9 flex-row items-center gap-1 self-start rounded-full border border-border bg-surface pl-3 pr-1">
        <Text className="text-xs font-medium text-foreground">{label} :</Text>
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="compact"
          themeVariant="light"
          accentColor={theme.colors.primary}
          onChange={handleChange}
        />
        <Pressable
          onPress={() => {
            onChange(undefined);
            setRevealed(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Effacer ${label}`}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          <X size={12} color={theme.colors.danger} />
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => (Platform.OS === "ios" ? setRevealed(true) : setShowAndroidPicker(true))}
        accessibilityRole="button"
        className="h-9 flex-row items-center gap-1 self-start rounded-full border border-border bg-surface px-3"
      >
        <Text className="text-xs font-medium text-foreground">
          {label} : {hasValue ? formatDate(value as string) : "-"}
        </Text>
        <ChevronDown size={12} color={theme.colors.muted} />
      </Pressable>
      {showAndroidPicker && Platform.OS === "android" ? (
        <DateTimePicker value={dateValue} mode="date" display="default" onChange={handleChange} />
      ) : null}
    </>
  );
}
