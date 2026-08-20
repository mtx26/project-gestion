import { theme as sharedTheme, themeColors } from "@project-gestion/config";
import { useColorScheme } from "nativewind";
import { Appearance } from "react-native";

/** `Appearance.getColorScheme()` peut aussi rendre `"unspecified"` : tout ce qui
 * n'est pas explicitement sombre retombe sur la palette claire. */
function paletteFor(scheme: string | null | undefined) {
  return scheme === "dark" ? themeColors.dark : themeColors.light;
}

export const theme = {
  /** Accesseur et non valeur figee : les ~150 appels imperatifs de l'app
   * (`color=` d'une icone, objets de style RN) suivent ainsi l'apparence du
   * systeme sans qu'aucun d'eux ait a changer.
   *
   * La lecture se fait au rendu. Un changement d'apparence redeclenche le rendu
   * des composants styles par NativeWind — c'est-a-dire la quasi-totalite — donc
   * l'accesseur est relu dans la foulee. Pour un composant qui n'aurait aucune
   * `className`, preferer `useThemeColors()`, qui s'abonne explicitement. */
  get colors() {
    return paletteFor(Appearance.getColorScheme());
  },
  spacing: sharedTheme.spacing,
  radius: sharedTheme.radius,
  typography: {
    title: { fontSize: 24, fontWeight: "600" as const },
    subtitle: { fontSize: 14, fontWeight: "600" as const },
    body: { fontSize: 14, fontWeight: "400" as const },
    label: { fontSize: 14, fontWeight: "500" as const },
  },
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
  },
  touchSize: {
    minimum: 44,
  },
} as const;

/** La palette courante, avec abonnement aux changements d'apparence. A preferer
 * a `theme.colors` dans tout nouveau composant : le rendu est garanti a jour. */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return paletteFor(colorScheme);
}
