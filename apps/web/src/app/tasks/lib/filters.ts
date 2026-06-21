import type { Task } from "@project-gestion/types";
import type { QueryClient } from "@tanstack/react-query";
import { parseEnumParam } from "@/lib/url-params";

export type StatusFilter = "all" | Task["status"];
export type PriorityFilter = "all" | Task["priority"];
export type FolderFilter = "all" | `folder-${number}`;

export function parseFolderFilter(value: string | null): FolderFilter {
  if (value?.startsWith("folder-") && Number(value.replace("folder-", "")) > 0) {
    return `folder-${Number(value.replace("folder-", "")) as number}`;
  }
  return "all";
}

const TASK_STATUS_VALUES = ["all", "todo", "in_progress", "done"] as const;
const TASK_PRIORITY_VALUES = ["all", "low", "normal", "high"] as const;

export function parseStatusFilter(value: string | null): StatusFilter {
  return parseEnumParam(value, TASK_STATUS_VALUES, "all");
}

export function parsePriorityFilter(value: string | null): PriorityFilter {
  return parseEnumParam(value, TASK_PRIORITY_VALUES, "all");
}

export function getFolderId(value: FolderFilter): number | null {
  if (value.startsWith("folder-")) return Number(value.replace("folder-", ""));
  return null;
}

export function buildTasksHref(projectId: number, searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("project", String(projectId));
  return `/tasks?${params.toString()}`;
}

export async function invalidateTasks(queryClient: QueryClient, projectId: number): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
}
