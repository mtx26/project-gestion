import { GlassContainer } from "expo-glass-effect";
import { createContext, useContext, type ReactNode } from "react";
import { View } from "react-native";

/** Hauteur reservee a la barre dans le defilement des listes. Les capsules
 * flottent au-dessus du contenu : sans cet espace en tete, les premieres lignes
 * passent dessous. Exportee pour que chaque ecran l'ajoute a son
 * `contentContainerStyle`. */
export const GLASS_BAR_HEIGHT = 56;

/** Vrai pour les controles poses dans une `GlassBar`. Ils se rendent alors en
 * capsule de verre autonome plutot qu'en pastille pleine : dans une feuille de
 * filtres, les memes controles gardent leur apparence pleine. */
const InGlassBarContext = createContext(false);

export function useInGlassBar(): boolean {
  return useContext(InGlassBarContext);
}

interface GlassBarProps {
  children: ReactNode;
}

/** La couche de navigation d'un ecran de liste : une rangee de `GlassCapsule`
 * epinglee sous le header, posee par-dessus le contenu.
 *
 * Le `GlassContainer` est ce qui fait l'effet iOS 26 : deux capsules qui se
 * rapprochent a moins de `spacing` se fondent l'une dans l'autre au lieu de rester
 * deux pastilles distinctes. Hors iOS il se comporte comme une simple `View`, donc
 * la rangee reste correcte partout.
 *
 * N'y mettre que des controles — jamais de contenu. */
export function GlassBar({ children }: GlassBarProps) {
  return (
    <View className="absolute left-0 right-0 top-0 z-10 px-4 pt-2" pointerEvents="box-none">
      <GlassContainer spacing={12} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <InGlassBarContext.Provider value>{children}</InGlassBarContext.Provider>
      </GlassContainer>
    </View>
  );
}
