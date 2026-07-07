import type { FolderTreeNode, TimeEntry } from "@project-gestion/types";

/** Finds the folder/task whose encoded `"folder-123"`/`"task-45"` value
 * matches, searching the tree as returned by the backend directly (no
 * intermediate copy) — `"project"` short-circuits since it isn't a real node. */
export function findTargetLabel(nodes: FolderTreeNode[], value: string): string | null {
  if (value === "project") return "Projet";
  for (const node of nodes) {
    if (node.type !== "folder" && node.type !== "task") continue;
    if (`${node.type}-${node.id}` === value) return node.name;
    if (node.type === "folder") {
      const label = findTargetLabel(node.children ?? [], value);
      if (label) return label;
    }
  }
  return null;
}

export function getTargetTypeFromValue(value: string): "project" | "folder" | "task" {
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

export type EntryTarget = { type: "task" | "folder"; id: number; name: string | null };

/** Unifies an entry's `task`/`folder` id+name pair into a single target — the
 * display counterpart to `getTargetValueFromEntry` (which builds the picker's
 * form value). Returns `null` when the entry is attached to the project. */
export function getEntryTarget(entry: {
  task: number | null;
  task_name?: string | null;
  folder: number | null;
  folder_name?: string | null;
}): EntryTarget | null {
  if (entry.task != null) return { type: "task", id: entry.task, name: entry.task_name ?? null };
  if (entry.folder != null) return { type: "folder", id: entry.folder, name: entry.folder_name ?? null };
  return null;
}

