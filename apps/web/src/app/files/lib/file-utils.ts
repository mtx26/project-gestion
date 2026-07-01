import type { FolderTreeNode } from "@project-gestion/types";

export { formatFileSize, getDocumentIconConfig, isImageFile } from "@/lib/file-display";

export type FileActionTarget = {
  type: "folder" | "document";
  id: number;
  name: string;
};

export const TREE_INDENT = 28;
export const TREE_ROW_PADDING = 0;

export function getTreeRowPadding(depth: number): number {
  return depth * TREE_INDENT + TREE_ROW_PADDING;
}

export function getTreeContentPadding(depth: number): number {
  return getTreeRowPadding(depth) + 32;
}

export function isFolderDescendantOf(
  nodes: FolderTreeNode[],
  ancestorId: number,
  candidateId: number,
): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === ancestorId) {
      return node.id === candidateId || containsFolderId(node.children ?? [], candidateId);
    }
    if (isFolderDescendantOf(node.children ?? [], ancestorId, candidateId)) return true;
  }
  return false;
}

export function containsFolderId(nodes: FolderTreeNode[], id: number): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === id) return true;
    if (containsFolderId(node.children ?? [], id)) return true;
  }
  return false;
}
