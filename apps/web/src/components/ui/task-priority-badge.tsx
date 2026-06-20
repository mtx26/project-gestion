import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@project-gestion/types";

export function TaskPriorityBadge({ priority }: { priority: Task["priority"] }) {
  if (priority === "high") {
    return (
      <Badge variant="secondary" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <ArrowUp className="size-3" />
        Haute
      </Badge>
    );
  }
  if (priority === "low") {
    return (
      <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <ArrowDown className="size-3" />
        Basse
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      <Minus className="size-3" />
      Normale
    </Badge>
  );
}
