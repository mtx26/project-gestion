import type { FolderTreeNode } from "@project-gestion/types";
import type { TargetValue } from "@project-gestion/domain";
import { TreePickerModal } from "./TreePickerModal";

interface TargetPickerModalProps {
  visible: boolean;
  /** Arbre en mode selecteur de cible : dossiers + taches (`includeTasks`). */
  tree: FolderTreeNode[];
  value: TargetValue;
  onChange: (value: TargetValue) => void;
  onClose: () => void;
}

/** Choix de la cible d'une entree : le projet, un dossier ou une tache — equivalent
 * natif du TargetField du web. Les cles de TreePickerModal sont deja encodees comme
 * une TargetValue, il n'y a donc rien a traduire ici. */
export function TargetPickerModal({ visible, tree, value, onChange, onClose }: TargetPickerModalProps) {
  return (
    <TreePickerModal
      visible={visible}
      title="Choisir une cible"
      tree={tree}
      includeTasks
      selectedKey={value}
      onSelect={onChange}
      onClose={onClose}
    />
  );
}
