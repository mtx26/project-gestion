import { RefreshControl, type RefreshControlProps } from "react-native";
import { useThemeColors } from "../../theme";

/** `RefreshControl` accorde a l'apparence courante.
 *
 * Sans teinte explicite, Android dessine son indicateur sur un disque blanc et
 * iOS un spinner gris clair : les deux jurent sur un fond sombre. Les props sont
 * differentes d'une plateforme a l'autre (`colors` / `progressBackgroundColor`
 * cote Android, `tintColor` cote iOS), d'ou ce composant plutot qu'un reglage
 * repete a chaque liste. */
export function ThemedRefreshControl(props: RefreshControlProps) {
  const colors = useThemeColors();

  return (
    <RefreshControl
      tintColor={colors.muted}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
      {...props}
    />
  );
}
