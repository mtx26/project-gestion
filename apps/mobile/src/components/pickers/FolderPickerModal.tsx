import type { FolderTreeNode } from "@project-gestion/types";
import { Check, ChevronDown, ChevronRight, Folder, X } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";

interface FolderPickerModalProps {
  visible: boolean;
  folders: FolderTreeNode[];
  selectedFolderId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

interface TreeRow {
  id: number | null;
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** Flattens the *visible* rows of the tree (root's children only if the root is
 * expanded, a folder's children only if that folder is expanded) so a plain
 * FlatList can render it — same expand/collapse behavior as web's TreePickerDialog,
 * without needing a recursive component tree. */
function collectVisibleRows(nodes: FolderTreeNode[], depth: number, expandedIds: Set<number>, rows: TreeRow[]) {
  for (const node of nodes) {
    if (node.type !== "folder") {
      continue;
    }
    const children = (node.children ?? []).filter((child) => child.type === "folder");
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    rows.push({ id: node.id, name: node.name, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      collectVisibleRows(children, depth + 1, expandedIds, rows);
    }
  }
}

export function FolderPickerModal({
  visible,
  folders,
  selectedFolderId,
  onSelect,
  onClose,
}: FolderPickerModalProps) {
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const rows: TreeRow[] = [
    { id: null, name: "Projet", depth: 0, hasChildren: folders.length > 0, isExpanded: rootExpanded },
  ];
  if (rootExpanded) {
    collectVisibleRows(folders, 1, expandedIds, rows);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* No "top" edge: a pageSheet already slides up below the status bar, so an
          added top inset here would just create an extra gap above the header. */}
      <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-2">
          <Text className="text-lg font-semibold text-foreground">Choisir un dossier</Text>
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
          data={rows}
          keyExtractor={(item) => String(item.id ?? "root")}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedFolderId;
            return (
              <View
                className="flex-row items-center border-b border-border pr-5"
                style={{ paddingLeft: 12 + item.depth * 20 }}
              >
                {item.hasChildren ? (
                  <Pressable
                    onPress={() => (item.id == null ? setRootExpanded((value) => !value) : toggleExpanded(item.id))}
                    accessibilityRole="button"
                    accessibilityLabel={item.isExpanded ? "Replier" : "Deplier"}
                    className="h-11 w-9 items-center justify-center"
                  >
                    {item.isExpanded ? (
                      <ChevronDown size={theme.iconSize.sm} color={theme.colors.muted} />
                    ) : (
                      <ChevronRight size={theme.iconSize.sm} color={theme.colors.muted} />
                    )}
                  </Pressable>
                ) : (
                  <View className="h-11 w-9" />
                )}
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  android_ripple={{ color: `${theme.colors.foreground}1f` }}
                  className={`h-11 min-h-[44px] flex-1 flex-row items-center gap-2 rounded-md px-2 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <Folder size={theme.iconSize.sm} color={isSelected ? theme.colors.primary : theme.colors.muted} />
                  <Text
                    className={`flex-1 text-base ${isSelected ? "font-medium text-primary" : "text-foreground"}`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? <Check size={theme.iconSize.sm} color={theme.colors.primary} /> : null}
                </Pressable>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
