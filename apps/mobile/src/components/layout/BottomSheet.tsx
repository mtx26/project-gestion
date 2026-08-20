import { BottomSheet as NativeBottomSheet } from "@expo/ui";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Generic bottom sheet shell: a card sliding up over a dimmed backdrop,
 * closable by tapping outside or "Fermer" — the native stand-in for web's
 * Sheet-based panels (filters, secondary option lists, etc). Reusable across
 * any page that needs this pattern, not just tasks.
 *
 * Adosse au sheet natif d'`@expo/ui` (`UISheetPresentationController` sur iOS,
 * `ModalBottomSheet` Compose sur Android) plutot qu'a un `Modal` transparent : on
 * recupere la poignee, le glisser-pour-fermer et le rebond du systeme, que le
 * fond assombri fait maison ne donnait pas. Le clavier est gere par le sheet
 * natif, d'ou la disparition du `KeyboardAvoidingView`. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  return (
    <NativeBottomSheet
      isPresented={visible}
      onDismiss={onClose}
      // `half` en repos et `full` atteignable : certaines feuilles portent un
      // formulaire (montant a payer, correction) qui deborde a mi-hauteur.
      snapPoints={["half", "full"]}
      // Le padding est porte par le contenu ci-dessous, pour garder l'en-tete
      // colle aux bords comme dans la version precedente.
      contentPadding={0}
    >
      <View className="border-b border-border">
        <View className="flex-row items-center justify-between px-5 py-3">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            className="h-9 justify-center"
          >
            <Text className="text-sm font-semibold text-primary">Fermer</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </NativeBottomSheet>
  );
}
