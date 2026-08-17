import type { Task } from "@project-gestion/types";
import { parseEnumParam } from "@/lib/url-params";

/** `not_done` (a faire + en cours) est le defaut de la page : une liste de taches sert
 * d'abord a voir ce qu'il reste. `all` est le seul statut qui reintegre les terminees. */
export type StatusFilter = "all" | "not_done" | Task["status"];
export type PriorityFilter = "all" | Task["priority"];
export type FolderFilter = "all" | `folder-${number}`;

export function parseFolderFilter(value: string | null): FolderFilter {
  if (value?.startsWith("folder-") && Number(value.replace("folder-", "")) > 0) {
    return `folder-${Number(value.replace("folder-", "")) as number}`;
  }
  return "all";
}

const TASK_STATUS_VALUES = ["all", "not_done", "todo", "in_progress", "done"] as const;
const TASK_PRIORITY_VALUES = ["all", "low", "normal", "high"] as const;

export function parseStatusFilter(value: string | null): StatusFilter {
  return parseEnumParam(value, TASK_STATUS_VALUES, "not_done");
}

export function parsePriorityFilter(value: string | null): PriorityFilter {
  return parseEnumParam(value, TASK_PRIORITY_VALUES, "all");
}

export function getFolderId(value: FolderFilter): number | null {
  if (value.startsWith("folder-")) return Number(value.replace("folder-", ""));
  return null;
}
