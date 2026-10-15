import { BottomSheet as NativeBottomSheet } from "@expo/ui";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Feuille modale des panneaux secondaires (filtres, choix, formulaires courts).
 *
 * Volontairement mince : le sheet natif d'`@expo/ui` gere deja la hauteur ajustee
 * au contenu, la poignee, le glisser-pour-fermer, le fond assombri, les marges
 * interieures et le clavier. Tout ce qui est ajoute ici doit etre quelque chose
 * qu'il ne fait pas — en l'occurrence, juste un titre.
 *
 * Pas de bouton « Fermer » ni de separateur : le systeme fournit deja la poignee
 * et le glisser. Pas de `contentPadding` non plus, ses marges par defaut sont les
 * bonnes. C'est en les surchargeant que la feuille s'etait retrouvee bloquee a
 * mi-hauteur. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  return (
    <NativeBottomSheet isPresented={visible} onDismiss={onClose}>
      <View className="gap-3">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        {children}
      </View>
    </NativeBottomSheet>
  );
}
