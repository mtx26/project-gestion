import type { FolderTreeNode } from "@project-gestion/types";
import { TreePickerModal } from "./TreePickerModal";

interface FolderPickerModalProps {
  visible: boolean;
  folders: FolderTreeNode[];
  selectedFolderId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

/** Choix d'un dossier du projet (ou de sa racine, `null`) — habillage de
 * TreePickerModal qui traduit la valeur encodee en identifiant de dossier. */
export function FolderPickerModal({
  visible,
  folders,
  selectedFolderId,
  onSelect,
  onClose,
}: FolderPickerModalProps) {
  return (
    <TreePickerModal
      visible={visible}
      title="Choisir un dossier"
      tree={folders}
      selectedKey={selectedFolderId == null ? "project" : `folder-${selectedFolderId}`}
      onSelect={(key) => onSelect(key === "project" ? null : Number(key.replace("folder-", "")))}
      onClose={onClose}
    />
  );
}
