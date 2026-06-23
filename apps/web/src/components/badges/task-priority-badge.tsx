import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Task } from "@project-gestion/types";
import { StatusBadge, type BadgeOption } from "./status-badge";

const OPTIONS: Record<NonNullable<Task["priority"]>, BadgeOption> = {
  high:   { label: "Haute",   icon: ArrowUp,   className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  medium: { label: "Normale", icon: Minus,      className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  low:    { label: "Basse",   icon: ArrowDown,  className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export function TaskPriorityBadge({ priority, className }: { priority: Task["priority"]; className?: string }) {
  if (!priority) return null;
  return <StatusBadge option={OPTIONS[priority]} className={className} />;
}
