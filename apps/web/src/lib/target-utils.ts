import type { FolderTreeNode, TimeEntry } from "@project-gestion/types";

export type TargetOption = {
  value: string;
  label: string;
  depth: number;
  type: "project" | "folder" | "task";
  status?: "todo" | "in_progress" | "done";
};

export type TargetTreeNode = TargetOption & {
  children: TargetTreeNode[];
};

export function buildTargetTree(nodes: FolderTreeNode[]): TargetTreeNode {
  const root: TargetTreeNode = {
    value: "project",
    label: "Projet",
    depth: 0,
    type: "project",
    children: buildFolderTargetTree(nodes, 1),
  };
  return root;
}

function buildFolderTargetTree(nodes: FolderTreeNode[], depth: number): TargetTreeNode[] {
  const result: TargetTreeNode[] = [];
  for (const node of nodes) {
    if (node.type !== "folder" && node.type !== "task") continue;
    result.push({
      value: `${node.type}-${node.id}`,
      label: node.name,
      depth,
      type: node.type,
      status: node.type === "task" ? node.status : undefined,
      children: node.type === "folder" ? buildFolderTargetTree(node.children ?? [], depth + 1) : [],
    });
  }
  return result;
}

export function findTargetLabel(node: TargetTreeNode, value: string): string | null {
  if (node.value === value) return node.label;
  for (const child of node.children) {
    const label = findTargetLabel(child, value);
    if (label) return label;
  }
  return null;
}

export function getTargetTypeFromValue(value: string): TargetTreeNode["type"] {
  if (value.startsWith("task-")) return "task";
  if (value.startsWith("folder-")) return "folder";
  return "project";
}

export function getTargetPayload(value: string): { folder: number | null; task: number | null } {
  if (value.startsWith("folder-")) return { folder: Number(value.replace("folder-", "")), task: null };
  if (value.startsWith("task-")) return { folder: null, task: Number(value.replace("task-", "")) };
  return { folder: null, task: null };
}

export function getTargetValueFromEntry(entry: Pick<TimeEntry, "folder" | "task">): string {
  if (entry.task != null) return `task-${entry.task}`;
  if (entry.folder != null) return `folder-${entry.folder}`;
  return "project";
}

export function collectTargetLabelsByType(node: TargetTreeNode, type: "folder" | "task"): Map<number, string> {
  const labels = new Map<number, string>();
  collectLabels(node, type, labels);
  return labels;
}

function collectLabels(node: TargetTreeNode, type: "folder" | "task", labels: Map<number, string>) {
  if (node.type === type) {
    labels.set(Number(node.value.replace(`${type}-`, "")), node.label);
  }
  for (const child of node.children) {
    collectLabels(child, type, labels);
  }
}

export function collectTaskFolderIds(node: TargetTreeNode): Map<number, number> {
  const taskFolderIds = new Map<number, number>();
  collectTaskFolderIdsInPlace(node, null, taskFolderIds);
  return taskFolderIds;
}

function collectTaskFolderIdsInPlace(
  node: TargetTreeNode,
  currentFolderId: number | null,
  taskFolderIds: Map<number, number>,
) {
  const folderId = node.type === "folder" ? Number(node.value.replace("folder-", "")) : currentFolderId;
  if (node.type === "task" && folderId != null) {
    taskFolderIds.set(Number(node.value.replace("task-", "")), folderId);
  }
  for (const child of node.children) {
    collectTaskFolderIdsInPlace(child, folderId, taskFolderIds);
  }
}
