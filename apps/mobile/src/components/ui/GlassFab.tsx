import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, useThemeColors } from "../../theme";
import { GlassSurface, useGlassEnabled } from "./GlassSurface";

/** Espace a reserver en pied de liste pour que la derniere ligne ne finisse pas
 * sous le bouton. A ajouter au `contentContainerStyle` des ecrans qui en portent un. */
export const GLASS_FAB_CLEARANCE = 88;

interface GlassFabProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}

/** Action principale d'un ecran, en capsule flottante ancree en bas a droite.
 *
 * Remplace le bouton pleine largeur qui defilait avec la liste : l'action reste
 * atteignable quel que soit le defilement, et au pouce. Sous iOS 26 la capsule est
 * en verre interactif — elle reagit au toucher comme les controles du systeme ;
 * ailleurs elle retombe sur la couleur primaire pleine. */
export function GlassFab({ icon: Icon, label, onPress }: GlassFabProps) {
  return (
    <GlassFabSlot>
      <GlassFabSurface>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="h-14 flex-row items-center gap-2 px-5"
        >
          <Icon size={theme.iconSize.md} color={theme.colors.primaryForeground} />
          <Text className="text-sm font-semibold text-primaryForeground">{label}</Text>
        </Pressable>
      </GlassFabSurface>
    </GlassFabSlot>
  );
}

/** L'ancrage seul, sans capsule : pour un declencheur qui gere lui-meme sa
 * pression (un menu, par exemple). */
export function GlassFabSlot({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 right-0 z-10 p-4"
      style={{ paddingBottom: insets.bottom + 16 }}
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

/** La capsule seule, sans gestion du tap — a envelopper dans un `UploadMenu` ou
 * tout autre declencheur qui fournit deja son propre Pressable. */
export function GlassFabSurface({ children }: { children: ReactNode }) {
  const glassEnabled = useGlassEnabled();
  const colors = useThemeColors();

  return (
    <GlassSurface
      style={{
        borderRadius: 28,
        overflow: "hidden",
        ...(glassEnabled
          ? null
          : {
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }),
      }}
      fallbackClassName="bg-primary"
      // Le verre est incolore : la teinte primaire porte l'identite de l'action,
      // sinon la capsule disparait sur un fond clair.
      tintColor={colors.primary}
      isInteractive
    >
      {children}
    </GlassSurface>
  );
}
