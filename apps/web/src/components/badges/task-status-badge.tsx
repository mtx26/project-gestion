import { Check, Circle, Clock } from "lucide-react";
import type { Task } from "@project-gestion/types";
import { StatusBadge, type BadgeOption } from "./status-badge";

const OPTIONS: Record<Task["status"], BadgeOption> = {
  todo:        { label: "À faire",  icon: Circle },
  in_progress: { label: "En cours", icon: Clock,  className: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  done:        { label: "Terminé",  icon: Check,  className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function TaskStatusBadge({ status = "todo", className }: { status?: Task["status"]; className?: string }) {
  return <StatusBadge option={OPTIONS[status]} className={className} />;
}
