import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface SelectMenuOption {
  label: string;
  value: string;
  destructive?: boolean;
  /** Sous-menu natif. L'entree n'est alors plus selectionnable elle-meme : c'est
   * la valeur de l'enfant choisi qui remonte par `onSelect`. */
  options?: SelectMenuOption[];
  /** Valeur cochee a l'interieur de `options`. */
  selected?: string;
}

interface SelectMenuProps {
  /** En-tete du menu. iOS seulement : le DropdownMenu Android n'a pas de titre. */
  title?: string;
  options: SelectMenuOption[];
  /** Valeur courante. Quand elle est fournie, l'entree correspondante porte une
   * coche et le menu se lit comme un choix ; sinon les entrees sont de simples
   * actions. */
  value?: string;
  onSelect: (value: string) => void;
  /** Le declencheur, ancre du menu. Il ne doit pas gerer le tap lui-meme :
   * `MenuView` l'enveloppe dans son propre Pressable sur Android, et le passe en
   * label du `Menu` SwiftUI sur iOS. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Ouvre au long press au lieu du tap — le declencheur garde alors son propre
   * `onPress`. C'est le menu contextuel des lignes de liste. */
  shouldOpenOnLongPress?: boolean;
  /** Android seulement : iOS declenche son propre retour haptique a l'ouverture
   * d'un menu contextuel, Compose non. */
  onOpenMenu?: () => void;
}

/** Menu natif de choix unique — `Menu` SwiftUI sur iOS, `DropdownMenu` Compose sur
 * Android, ancre sous son declencheur. Remplace l'action sheet qui servait de
 * dropdown : depuis iOS 14 le pull-down menu est le pattern Apple pour choisir une
 * valeur depuis un bouton, et lui sait afficher la coche de la valeur active. */
export function SelectMenu({
  title,
  options,
  value,
  onSelect,
  children,
  style,
  shouldOpenOnLongPress,
  onOpenMenu,
}: SelectMenuProps) {
  function toAction(option: SelectMenuOption, selectedValue: string | undefined): MenuAction {
    if (option.options) {
      return {
        id: option.value,
        title: option.label,
        subactions: option.options.map((child) => toAction(child, option.selected)),
      };
    }
    return {
      id: option.value,
      title: option.label,
      // Pas de `state` du tout quand l'appelant ne suit pas de valeur : les entrees
      // restent des boutons, sans colonne de coche.
      state: selectedValue === undefined ? undefined : option.value === selectedValue ? "on" : "off",
      attributes: option.destructive ? { destructive: true } : undefined,
    };
  }

  const actions: MenuAction[] = options.map((option) => toAction(option, value));

  return (
    <MenuView
      title={title}
      actions={actions}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}
      style={style}
      shouldOpenOnLongPress={shouldOpenOnLongPress}
      onOpenMenu={onOpenMenu}
    >
      {children}
    </MenuView>
  );
}
