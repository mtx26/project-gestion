import { RefreshControl, type RefreshControlProps } from "react-native";
import { useThemeColors } from "../../theme";

/** `RefreshControl` accorde a l'apparence courante.
 *
 * Une seule chose est corrigee : sur Android, l'indicateur est dessine sur un
 * disque dont la couleur ne suit pas le theme et reste blanc sur fond sombre.
 * Le spinner iOS, lui, s'adapte tout seul — on ne le touche pas. */
export function ThemedRefreshControl(props: RefreshControlProps) {
  const colors = useThemeColors();

  return <RefreshControl progressBackgroundColor={colors.surface} {...props} />;
}
