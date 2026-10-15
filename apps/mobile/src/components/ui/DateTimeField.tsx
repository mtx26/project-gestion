import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarClock } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { formatDate, formatDateTime } from "../../lib/date-format";
import { theme } from "../../theme";

interface DateTimeFieldProps {
  label: string;
  /** Date ISO (UTC), ou `""` pour un champ vide (seulement avec `clearable`).
   * Le champ affiche et saisit l'heure locale. */
  value: string;
  onChange: (isoValue: string) => void;
  /** `"date"` n'expose que le jour (la date d'une ecriture financiere par exemple) ;
   * `"datetime"` enchaine jour puis heure. */
  mode?: "date" | "datetime";
  /** Pour un champ optionnel : affiche "Non definie" tant qu'aucune date n'est
   * choisie, et propose de l'effacer ensuite (`onChange("")`). */
  clearable?: boolean;
  error?: string;
}

/** Saisie d'une date (et heure) avec le vrai selecteur natif : le widget compact
 * d'iOS, et l'enchainement dialogue date puis dialogue heure d'Android — equivalent
 * natif des `<input type="date">` / `datetime-local` du web.
 *
 * L'enchainement Android est necessaire : le picker natif d'Android n'a pas de mode
 * "datetime", il ne sait ouvrir qu'un dialogue date *ou* un dialogue heure. */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = "datetime",
  clearable = false,
  error,
}: DateTimeFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [androidStage, setAndroidStage] = useState<"idle" | "date" | "time">("idle");
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const hasValue = Boolean(value);
  const currentDate = hasValue ? new Date(value) : new Date();
  const displayValue = !hasValue
    ? "Non definie"
    : mode === "date"
      ? formatDate(value)
      : formatDateTime(value);

  function handleAndroidDate(event: { type: string }, selected?: Date) {
    if (event.type !== "set" || !selected) {
      setAndroidStage("idle");
      return;
    }
    if (mode === "date") {
      setAndroidStage("idle");
      onChange(selected.toISOString());
      return;
    }
    setPendingDate(selected);
    setAndroidStage("time");
  }

  function handleAndroidTime(event: { type: string }, selected?: Date) {
    setAndroidStage("idle");
    if (event.type !== "set" || !selected) {
      return;
    }
    const base = pendingDate ?? currentDate;
    const combined = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      selected.getHours(),
      selected.getMinutes(),
    );
    onChange(combined.toISOString());
  }

  // iOS : une fois revele (ou des qu'une valeur existe), on montre directement le
  // controle "compact" de la librairie — c'est un vrai composant natif qui ouvre le
  // popover du systeme au tap, il n'y a donc rien a construire ni a fermer de notre
  // cote. Avant ca, un simple bouton tient la place pour qu'un champ optionnel ait
  // l'air vide au lieu d'afficher "maintenant".
  const showCompactPicker = Platform.OS === "ios" && (hasValue || revealed || !clearable);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>

      {showCompactPicker ? (
        <View className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3">
          <Text className="text-base text-foreground">{displayValue}</Text>
          <DateTimePicker
            value={currentDate}
            mode={mode}
            display="compact"
            themeVariant="light"
            accentColor={theme.colors.primary}
            onChange={(_, selected) => selected && onChange(selected.toISOString())}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => (Platform.OS === "ios" ? setRevealed(true) : setAndroidStage("date"))}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3"
        >
          <Text className={`text-base ${hasValue ? "text-foreground" : "text-muted"}`}>{displayValue}</Text>
          <CalendarClock size={theme.iconSize.sm} color={theme.colors.muted} />
        </Pressable>
      )}

      {clearable && hasValue ? (
        <Pressable
          onPress={() => {
            onChange("");
            setRevealed(false);
          }}
          accessibilityRole="button"
        >
          <Text className="text-xs text-danger">Effacer la date</Text>
        </Pressable>
      ) : null}

      {androidStage === "date" ? (
        <DateTimePicker value={currentDate} mode="date" display="default" onChange={handleAndroidDate} />
      ) : null}
      {androidStage === "time" ? (
        <DateTimePicker
          value={pendingDate ?? currentDate}
          mode="time"
          is24Hour
          display="default"
          onChange={handleAndroidTime}
        />
      ) : null}

      {error ? (
        <Text className="text-sm text-danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
