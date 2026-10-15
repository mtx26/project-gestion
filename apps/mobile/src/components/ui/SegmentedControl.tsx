import { SegmentedControl as NativeSegmentedControl } from "@expo/ui/community/segmented-control";
import { View } from "react-native";

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
 * natif d'un `<Select>` du web quand la liste est trop courte pour meriter un menu
 * (mode de paiement, type d'ecriture...).
 *
 * Adosse au controle natif (`UISegmentedControl` sur iOS, son equivalent Compose sur
 * Android) : il suit l'apparence du systeme, y compris le theme sombre, la ou la
 * version maison figeait ses couleurs. L'API reste par valeur, pas par index —
 * le natif raisonne en index, la conversion se fait ici. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const selectedIndex = options.findIndex((option) => option.value === value);

  return (
    // Le controle natif n'expose pas `accessibilityLabel` : il reste porte par le
    // conteneur, comme dans la version precedente.
    <View accessibilityLabel={accessibilityLabel}>
      <NativeSegmentedControl
        values={options.map((option) => option.label)}
        selectedIndex={selectedIndex < 0 ? undefined : selectedIndex}
        onChange={({ nativeEvent }) => {
          const option = options[nativeEvent.selectedSegmentIndex];
          if (option) {
            onChange(option.value);
          }
        }}
      />
    </View>
  );
}
