import { findFolderNode } from "@project-gestion/domain";
import type { FolderTreeNode } from "@project-gestion/types";

export interface BreadcrumbEntry {
  /** `null` pour la racine du projet. */
  id: number | null;
  name: string;
}

/** Contenu direct du dossier ouvert : la racine expose le premier niveau de l'arbre.
 * Les dossiers passent avant les documents, comme dans un explorateur de fichiers. */
export function getFolderChildren(tree: FolderTreeNode[], folderId: number | null): FolderTreeNode[] {
  const children = folderId == null ? tree : (findFolderNode(tree, folderId)?.children ?? []);
  return [...children]
    .filter((node) => node.type === "folder" || node.type === "document")
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "fr");
    });
}

/** Chemin de la racine jusqu'au dossier ouvert — ce que le fil d'Ariane affiche, et
 * ce qui permet de remonter d'un cran a la fois. */
export function getFolderPath(
  tree: FolderTreeNode[],
  folderId: number | null,
  rootLabel = "Projet",
): BreadcrumbEntry[] {
  const root: BreadcrumbEntry = { id: null, name: rootLabel };
  if (folderId == null) {
    return [root];
  }

  const path: BreadcrumbEntry[] = [];
  const walk = (nodes: FolderTreeNode[], trail: BreadcrumbEntry[]): boolean => {
    for (const node of nodes) {
      if (node.type !== "folder") {
        continue;
      }
      const nextTrail = [...trail, { id: node.id, name: node.name }];
      if (node.id === folderId) {
        path.push(...nextTrail);
        return true;
      }
      if (walk(node.children ?? [], nextTrail)) {
        return true;
      }
    }
    return false;
  };
  walk(tree, []);

  // Dossier introuvable (supprime entre-temps, arbre pas encore recharge) : on
  // retombe sur la racine plutot que d'afficher un fil d'Ariane vide.
  return path.length > 0 ? [root, ...path] : [root];
}
