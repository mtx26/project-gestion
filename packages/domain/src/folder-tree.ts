import type { FolderTreeNode } from "@project-gestion/types";

/** Parcours de l'arbre du projet tel que le backend le renvoie. Purement structurel :
 * le rendu (composant recursif cote web, liste aplatie cote mobile) reste dans chaque
 * app, mais les recherches et les resolutions de nom sont les memes des deux cotes. */

export function findFolderName(nodes: FolderTreeNode[], folderId: number | null): string | null {
  if (folderId == null) return null;
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.id === folderId) return node.name;
      const nested = findFolderName(node.children ?? [], folderId);
      if (nested) return nested;
    }
  }
  return null;
}

export function buildFolderNameMap(
  nodes: FolderTreeNode[],
  map = new Map<number, string>(),
): Map<number, string> {
  for (const node of nodes) {
    if (node.type === "folder") {
      map.set(node.id, node.name);
      buildFolderNameMap(node.children ?? [], map);
    }
  }
  return map;
}

export function findTreeNode(nodes: FolderTreeNode[], id: number): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTreeNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export function findFolderNode(nodes: FolderTreeNode[], folderId: number | null): FolderTreeNode | null {
  if (folderId == null) return null;
  return findTreeNode(nodes, folderId);
}

/** True si `candidateId` est `ancestorId` lui-meme ou l'un de ses sous-dossiers —
 * le garde-fou derriere "on ne peut pas deplacer un dossier dans son propre sous-arbre". */
export function isFolderDescendantOf(
  nodes: FolderTreeNode[],
  ancestorId: number,
  candidateId: number,
): boolean {
  const ancestor = findTreeNode(nodes, ancestorId);
  if (!ancestor) return false;
  const descendantIds = new Set<number>();
  collectFolderIds(ancestor, descendantIds);
  return descendantIds.has(candidateId);
}

function collectFolderIds(node: FolderTreeNode, ids: Set<number>) {
  if (node.type === "folder") {
    ids.add(node.id);
    for (const child of node.children ?? []) {
      collectFolderIds(child, ids);
    }
  }
}
