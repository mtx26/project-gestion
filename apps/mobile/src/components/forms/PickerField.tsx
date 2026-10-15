import { ChevronDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SelectMenu, type SelectMenuOption } from "../menus/SelectMenu";
import { theme } from "../../theme";

/** Le visuel seul du champ, sans gestion du tap — declencheur d'un `SelectMenu`,
 * qui fournit lui-meme le Pressable. */
export function PickerFieldBody({ value }: { value: string }) {
  return (
    <View
      accessibilityRole="button"
      className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3"
    >
      <Text className="flex-1 text-base text-foreground" numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
      <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
    </View>
  );
}

/** Champ de formulaire qui ouvre un ecran a part (arbre de dossiers, choix
 * multiple). Pour un choix dans une liste plate, prendre `SelectPickerField`. */
export function PickerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Pressable onPress={onPress} accessibilityRole="button">
        <PickerFieldBody value={value} />
      </Pressable>
    </View>
  );
}

/** Champ de formulaire qui ouvre un menu natif ancre sous lui. */
export function SelectPickerField({
  label,
  value,
  title,
  options,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  title?: string;
  options: SelectMenuOption[];
  selected?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <SelectMenu title={title} options={options} value={selected} onSelect={onSelect}>
        <PickerFieldBody value={value} />
      </SelectMenu>
    </View>
  );
}
