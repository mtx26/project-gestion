import { ChevronDown } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SelectMenu, type SelectMenuOption } from "../menus/SelectMenu";
import { theme, useThemeColors } from "../../theme";

interface FilterRowBodyProps {
  label: string;
  value: string;
}

/** Le visuel d'une ligne de filtre : intitule a gauche, valeur courante a droite.
 *
 * Les feuilles de filtres presentaient jusqu'ici des puces `h-9` en `text-xs` qui
 * s'enroulaient sur plusieurs lignes : illisibles, et sous les 44pt de cible
 * tactile. Une ligne pleine largeur laisse la place d'ecrire la valeur en entier. */
function FilterRowBody({ label, value }: FilterRowBodyProps) {
  const colors = useThemeColors();

  return (
    <View className="min-h-[48px] flex-row items-center gap-3 px-4 py-2">
      <Text className="text-base text-foreground">{label}</Text>
      <View className="flex-1 flex-row items-center justify-end gap-1">
        <Text className="text-sm text-muted" numberOfLines={1}>
          {value}
        </Text>
        <ChevronDown size={theme.iconSize.sm} color={colors.muted} />
      </View>
    </View>
  );
}

export interface FilterRowConfig {
  /** Intitule du filtre, sans sa valeur — « Statut », pas « Statut : Termine ». */
  label: string;
  /** Valeur courante, affichee a droite. */
  value: string;
  /** En-tete du menu natif (iOS). Reprend `label` par defaut. */
  title?: string;
  options: SelectMenuOption[];
  selected?: string;
  onSelect: (value: string) => void;
}

type SelectFilterRowProps = FilterRowConfig & { isLast?: boolean };

/** Une ligne de filtre qui ouvre un menu natif ancre. */
export function SelectFilterRow({
  label,
  value,
  title,
  options,
  selected,
  onSelect,
  isLast,
}: SelectFilterRowProps) {
  return (
    <View className={isLast ? "" : "border-b border-border"}>
      <SelectMenu title={title ?? label} options={options} value={selected} onSelect={onSelect}>
        <FilterRowBody label={label} value={value} />
      </SelectMenu>
    </View>
  );
}

interface PressFilterRowProps {
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
}

/** Une ligne de filtre qui ouvre un ecran a part (arbre de dossiers, cible...). */
export function PressFilterRow({ label, value, onPress, isLast }: PressFilterRowProps) {
  return (
    <View className={isLast ? "" : "border-b border-border"}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <FilterRowBody label={label} value={value} />
      </Pressable>
    </View>
  );
}
