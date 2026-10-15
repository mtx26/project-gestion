import type { FolderTreeNode } from "@project-gestion/types";
import { isImageFile } from "@/lib/file-display";

/** Les parcours d'arbre purs (recherche d'un dossier, table des noms, test de
 * sous-arbre) vivent dans `@project-gestion/domain`, partages avec le mobile. Ne
 * reste ici que ce qui depend de l'affichage web des fichiers. */
export function collectImageDocumentIds(nodes: FolderTreeNode[], ids: number[] = []): number[] {
  for (const node of nodes) {
    if (node.type === "document" && isImageFile(node)) ids.push(node.id);
    if (node.children) collectImageDocumentIds(node.children, ids);
  }
  return ids;
}
