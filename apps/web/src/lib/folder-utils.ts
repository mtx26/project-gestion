import type { FolderTreeNode } from "@project-gestion/types";
import { isImageFile } from "@/lib/file-display";

export function collectImageDocumentIds(nodes: FolderTreeNode[], ids: number[] = []): number[] {
  for (const node of nodes) {
    if (node.type === "document" && isImageFile(node)) ids.push(node.id);
    if (node.children) collectImageDocumentIds(node.children, ids);
  }
  return ids;
}

export function buildFolderNameMap(nodes: FolderTreeNode[], map = new Map<number, string>()): Map<number, string> {
  for (const node of nodes) {
    if (node.type === "folder") {
      map.set(node.id, node.name);
      buildFolderNameMap(node.children ?? [], map);
    }
  }
  return map;
}

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

/** True if `candidateId` is `ancestorId` itself or one of its folder descendants
 * — the guard behind "can't drop/move a folder into its own subtree". */
export function isFolderDescendantOf(nodes: FolderTreeNode[], ancestorId: number, candidateId: number): boolean {
  const ancestor = findTreeNode(nodes, ancestorId);
  if (!ancestor) return false;
  const descendantIds = new Set<number>();
  collectFolderIds(ancestor, descendantIds);
  return descendantIds.has(candidateId);
}

export function findFolderNode(nodes: FolderTreeNode[], folderId: number | null): FolderTreeNode | null {
  if (folderId == null) return null;
  return findTreeNode(nodes, folderId);
}

function findTreeNode(nodes: FolderTreeNode[], id: number): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTreeNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function collectFolderIds(node: FolderTreeNode, ids: Set<number>) {
  if (node.type === "folder") {
    ids.add(node.id);
    for (const child of node.children ?? []) {
      collectFolderIds(child, ids);
    }
  }
}
