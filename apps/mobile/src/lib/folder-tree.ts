import type { FolderTreeNode } from "@project-gestion/types";

export interface FlatFolderOption {
  id: number;
  name: string;
  depth: number;
}

export function flattenFolderTree(nodes: FolderTreeNode[], depth = 0): FlatFolderOption[] {
  const result: FlatFolderOption[] = [];
  for (const node of nodes) {
    if (node.type !== "folder") {
      continue;
    }
    result.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  }
  return result;
}

export function findFolderName(nodes: FolderTreeNode[], id: number | null): string | null {
  if (id == null) {
    return null;
  }
  for (const node of nodes) {
    if (node.type === "folder" && node.id === id) {
      return node.name;
    }
    if (node.children?.length) {
      const found = findFolderName(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
