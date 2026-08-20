import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../../theme";
import { GlassSurface, useGlassEnabled } from "./GlassSurface";

interface GlassCapsuleProps {
  children: ReactNode;
  /** Etat actif : la capsule prend la couleur d'accentuation du projet. C'est le
   * seul endroit ou le vert apparait dans la couche de navigation, ce qui rend
   * l'etat lisible d'un coup d'oeil. */
  active?: boolean;
  /** La capsule est pressable — le verre reagit alors au toucher. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Un controle de la couche de navigation, en capsule de verre autonome.
 *
 * C'est l'unite de base du motif iOS 26 : des capsules distinctes qui flottent
 * au-dessus du contenu et fusionnent entre elles quand elles se touchent (voir
 * `GlassBar`, qui les regroupe dans un `GlassContainer`). Un seul grand pavé de
 * verre ne produit pas cet effet.
 *
 * Hors iOS 26, la capsule retombe sur la surface pleine bordée habituelle — ou
 * sur le vert plein quand elle est active. */
export function GlassCapsule({ children, active, interactive, style }: GlassCapsuleProps) {
  const glassEnabled = useGlassEnabled();
  // Ce composant n'a aucune className : sans abonnement, la teinte verte
  // resterait celle du mode clair apres bascule en sombre.
  const colors = useThemeColors();

  return (
    <GlassSurface
      style={[
        {
          borderRadius: 999,
          overflow: "hidden",
          ...(glassEnabled
            ? null
            : {
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }),
        },
        style,
      ]}
      fallbackClassName={active ? "bg-primary" : "border border-border bg-surface"}
      tintColor={active ? colors.primary : undefined}
      isInteractive={interactive}
    >
      {children}
    </GlassSurface>
  );
}
