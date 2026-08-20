import { formatBytes } from "@project-gestion/domain";
import type { FolderTreeNode } from "@project-gestion/types";
import { ChevronRight, FileText, Folder, Image as ImageIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { theme } from "../../../theme";

interface FileRowProps {
  node: FolderTreeNode;
  /** Un document en cours d'ouverture (recuperation de l'URL signee). */
  isOpening?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/** Une ligne de l'explorateur : un tap ouvre (on entre dans le dossier, on affiche le
 * document), un appui long ouvre le menu d'actions. */
export function FileRow({ node, isOpening, onPress, onLongPress }: FileRowProps) {
  const isFolder = node.type === "folder";
  const Icon = isFolder ? Folder : node.mime_type?.startsWith("image/") ? ImageIcon : FileText;
  const childCount = isFolder ? (node.children?.length ?? 0) : 0;
  const sizeLabel = isFolder ? "" : formatBytes(node.file_size);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint="Appui long pour les actions"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className="min-h-[56px] flex-row items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
    >
      {isOpening ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Icon size={theme.iconSize.md} color={isFolder ? theme.colors.primary : theme.colors.muted} />
      )}
      <View className="flex-1">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {node.name}
        </Text>
        {isFolder ? (
          <Text className="text-xs text-muted">
            {childCount === 0 ? "Vide" : `${childCount} element${childCount > 1 ? "s" : ""}`}
          </Text>
        ) : sizeLabel ? (
          <Text className="text-xs text-muted">{sizeLabel}</Text>
        ) : null}
      </View>
      {isFolder ? <ChevronRight size={theme.iconSize.sm} color={theme.colors.muted} /> : null}
    </Pressable>
  );
}
