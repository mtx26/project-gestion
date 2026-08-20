import { Pressable, Text, View } from "react-native";

interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Choix exclusif entre deux ou trois options courtes, toutes visibles — l'equivalent
 * natif d'un `<Select>` du web quand la liste est trop courte pour meriter un action
 * sheet (mode de paiement, type d'ecriture...). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className="h-11 flex-row items-center gap-1 rounded-md border border-border bg-background p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={`h-full flex-1 items-center justify-center rounded ${isSelected ? "bg-primary" : ""}`}
          >
            <Text
              className={`text-sm font-medium ${isSelected ? "text-primaryForeground" : "text-foreground"}`}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
