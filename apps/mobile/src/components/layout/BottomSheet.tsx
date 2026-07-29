import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Generic bottom sheet shell: a card sliding up over a dimmed backdrop,
 * closable by tapping outside or "Fermer" — the native stand-in for web's
 * Sheet-based panels (filters, secondary option lists, etc). Reusable across
 * any page that needs this pattern, not just tasks. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/30"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <SafeAreaView edges={["bottom"]} className="rounded-t-xl border-t border-border bg-surface">
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" className="h-9 justify-center">
            <Text className="text-sm font-semibold text-primary">Fermer</Text>
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: "80%" }} contentContainerStyle={{ padding: 20, gap: 12 }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
