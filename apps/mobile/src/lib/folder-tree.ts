import type { FolderTreeNode } from "@project-gestion/types";

/** Une ligne affichable de l'arbre d'un selecteur (TreePickerModal). `key` est la
 * valeur encodee de la cible (`"project"` / `"folder-12"` / `"task-4"`), identique
 * a celle utilisee par les filtres et les payloads (voir `TargetValue` dans
 * `@project-gestion/domain`). */
export interface TreePickerRow {
  key: string;
  type: "project" | "folder" | "task";
  name: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** Aplatit les lignes *visibles* de l'arbre (les enfants d'un dossier seulement si
 * ce dossier est deplie) pour qu'une simple FlatList puisse le rendre — memes
 * ouvertures/fermetures que le TreePickerDialog du web, sans arbre de composants
 * recursif. Propre au mobile : c'est du rendu de liste, pas du parcours d'arbre
 * (celui-la vit dans `@project-gestion/domain`). */
export function collectVisibleTreeRows(
  nodes: FolderTreeNode[],
  options: { expandedIds: Set<number>; includeTasks?: boolean },
  depth = 1,
  rows: TreePickerRow[] = [],
): TreePickerRow[] {
  for (const node of nodes) {
    if (node.type === "task") {
      if (options.includeTasks) {
        rows.push({ key: `task-${node.id}`, type: "task", name: node.name, depth, hasChildren: false, isExpanded: false });
      }
      continue;
    }
    if (node.type !== "folder") {
      continue;
    }
    const children = (node.children ?? []).filter(
      (child) => child.type === "folder" || (options.includeTasks && child.type === "task"),
    );
    const isExpanded = options.expandedIds.has(node.id);
    rows.push({
      key: `folder-${node.id}`,
      type: "folder",
      name: node.name,
      depth,
      hasChildren: children.length > 0,
      isExpanded,
    });
    if (children.length > 0 && isExpanded) {
      collectVisibleTreeRows(children, options, depth + 1, rows);
    }
  }
  return rows;
}
