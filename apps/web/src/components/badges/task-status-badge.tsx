import { Check, Circle, Clock } from "lucide-react";
import type { Task } from "@project-gestion/types";
import { StatusBadge, type BadgeOption } from "./status-badge";

/** Single source of truth for task status colors — badge (`className`) and the
 * editable Select trigger in TaskTable (`selectClassName`) share the same palette. */
const OPTIONS: Record<Task["status"], BadgeOption & { selectClassName: string }> = {
  todo: {
    label: "À faire",
    icon: Circle,
    selectClassName: "border-muted bg-background text-muted-foreground",
  },
  in_progress: {
    label: "En cours",
    icon: Clock,
    className: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    selectClassName: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  done: {
    label: "Terminé",
    icon: Check,
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    selectClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export function TaskStatusBadge({ status = "todo", className }: { status?: Task["status"]; className?: string }) {
  return <StatusBadge option={OPTIONS[status]} className={className} />;
}

export function getTaskStatusSelectClassName(status: Task["status"]) {
  return OPTIONS[status].selectClassName;
}

/** Plain color classes for contexts that can't render a full `<StatusBadge>` (e.g. calendar chips). */
export function getTaskStatusChipClassName(status: Task["status"]): string {
  return OPTIONS[status].className ?? "bg-secondary text-secondary-foreground";
}
