import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { BottomSheet } from "./BottomSheet";

export interface OptionSheetOption {
  label: string;
  value: string;
  destructive?: boolean;
}

interface OptionSheetProps {
  visible: boolean;
  title: string;
  options: OptionSheetOption[];
  /** Coche l'option courante quand l'appelant la connait. */
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Liste de choix en bottom sheet — le rendu Android de `useActionSheet` (iOS utilise
 * l'action sheet natif du systeme). Une liste, et pas des boutons d'`Alert` : Android
 * n'affiche que trois boutons dans une alerte, ce qui tronquait les filtres a plus de
 * trois valeurs. */
export function OptionSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View className="gap-1">
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              android_ripple={{ color: `${theme.colors.foreground}1f` }}
              className={`min-h-[48px] flex-row items-center gap-3 rounded-md px-3 py-3 ${
                isSelected ? "bg-primary/10" : ""
              }`}
            >
              <Text
                className={`flex-1 text-base ${
                  option.destructive
                    ? "font-medium text-danger"
                    : isSelected
                      ? "font-medium text-primary"
                      : "text-foreground"
                }`}
                numberOfLines={2}
              >
                {option.label}
              </Text>
              {isSelected ? <Check size={theme.iconSize.sm} color={theme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
