import type { FolderTreeNode } from "@project-gestion/types";
import { Check, X } from "lucide-react-native";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { flattenFolderTree } from "../../lib/folder-tree";
import { theme } from "../../theme";

interface FolderPickerModalProps {
  visible: boolean;
  folders: FolderTreeNode[];
  selectedFolderId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

export function FolderPickerModal({
  visible,
  folders,
  selectedFolderId,
  onSelect,
  onClose,
}: FolderPickerModalProps) {
  const options = [{ id: null as number | null, name: "Projet (racine)", depth: 0 }, ...flattenFolderTree(folders)];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
          <Text className="text-lg font-semibold text-foreground">Choisir un dossier</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8}>
            <X size={theme.iconSize.md} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id ?? "root")}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item.id);
                onClose();
              }}
              accessibilityRole="button"
              android_ripple={{ color: `${theme.colors.foreground}1f` }}
              style={{ paddingLeft: 20 + item.depth * 16 }}
              className="min-h-[44px] flex-row items-center justify-between border-b border-border py-3 pr-5"
            >
              <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              {selectedFolderId === item.id ? (
                <Check size={theme.iconSize.sm} color={theme.colors.primary} />
              ) : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
