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
