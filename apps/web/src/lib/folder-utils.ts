import type { FolderTreeNode } from "@project-gestion/types";

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

export function getDescendantFolderIds(nodes: FolderTreeNode[], targetId: number | null): Set<number> | null {
  if (targetId == null) return null;
  const target = findTreeNode(nodes, targetId);
  const ids = new Set<number>();
  if (target) collectFolderIds(target, ids);
  else ids.add(targetId);
  return ids;
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
