import type { ProjectMember } from "@project-gestion/types";
import { Check, X } from "lucide-react-native";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";

interface MemberMultiSelectModalProps {
  visible: boolean;
  members: ProjectMember[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onClose: () => void;
}

export function MemberMultiSelectModal({
  visible,
  members,
  selectedIds,
  onChange,
  onClose,
}: MemberMultiSelectModalProps) {
  function toggle(userId: number) {
    onChange(
      selectedIds.includes(userId)
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* No "top" edge: a pageSheet already slides up below the status bar, so an
          added top inset here would just create an extra gap above the header. */}
      <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-2">
          <Text className="text-lg font-semibold text-foreground">Assigner des membres</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            className="h-11 w-11 items-center justify-center"
          >
            <X size={theme.iconSize.md} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <FlatList
          data={members}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text className="px-5 py-6 text-sm text-muted">Aucun membre dans ce projet.</Text>
          }
          renderItem={({ item }) => {
            const checked = selectedIds.includes(item.user);
            return (
              <Pressable
                onPress={() => toggle(item.user)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                android_ripple={{ color: `${theme.colors.foreground}1f` }}
                className="min-h-[44px] flex-row items-center justify-between border-b border-border px-5 py-3"
              >
                <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
                  {item.user_display_name}
                </Text>
                {checked ? <Check size={theme.iconSize.sm} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
