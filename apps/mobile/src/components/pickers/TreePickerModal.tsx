import type { FolderTreeNode } from "@project-gestion/types";
import { Check, ChevronDown, ChevronRight, Folder, ListChecks, X } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collectVisibleTreeRows, type TreePickerRow } from "../../lib/folder-tree";
import { theme } from "../../theme";

interface TreePickerModalProps {
  visible: boolean;
  title: string;
  tree: FolderTreeNode[];
  /** Ajoute les taches aux lignes selectionnables (selecteur de cible d'une entree). */
  includeTasks?: boolean;
  /** Valeur encodee de la ligne selectionnee : `"project"`, `"folder-<id>"` ou `"task-<id>"`. */
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

/** Selecteur d'arbre du projet, presente en pageSheet native. Rendu partage par
 * FolderPickerModal (dossiers seuls) et TargetPickerModal (dossiers + taches) :
 * les deux ne different que par la valeur qu'ils exposent a leur appelant. */
export function TreePickerModal({
  visible,
  title,
  tree,
  includeTasks = false,
  selectedKey,
  onSelect,
  onClose,
}: TreePickerModalProps) {
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleExpanded(key: string) {
    const id = Number(key.replace("folder-", ""));
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

  const rows: TreePickerRow[] = [
    { key: "project", type: "project", name: "Projet", depth: 0, hasChildren: tree.length > 0, isExpanded: rootExpanded },
    ...(rootExpanded ? collectVisibleTreeRows(tree, { expandedIds, includeTasks }) : []),
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* No "top" edge: a pageSheet already slides up below the status bar, so an
          added top inset here would just create an extra gap above the header. */}
      <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-2">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
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
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isSelected = item.key === selectedKey;
            const RowIcon = item.type === "task" ? ListChecks : Folder;
            return (
              <View
                className="flex-row items-center border-b border-border pr-5"
                style={{ paddingLeft: 12 + item.depth * 20 }}
              >
                {item.hasChildren ? (
                  <Pressable
                    onPress={() => (item.type === "project" ? setRootExpanded((value) => !value) : toggleExpanded(item.key))}
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
                    onSelect(item.key);
                    onClose();
                  }}
                  accessibilityRole="button"
                  android_ripple={{ color: `${theme.colors.foreground}1f` }}
                  className={`h-11 min-h-[44px] flex-1 flex-row items-center gap-2 rounded-md px-2 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  <RowIcon size={theme.iconSize.sm} color={isSelected ? theme.colors.primary : theme.colors.muted} />
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
