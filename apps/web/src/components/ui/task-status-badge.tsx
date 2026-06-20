import { Check, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@project-gestion/types";

export function TaskStatusBadge({ status = "todo", className }: { status?: Task["status"]; className?: string }) {
  if (status === "done") {
    return (
      <Badge variant="secondary" className={cn("bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", className)}>
        <Check className="size-3" />
        Terminé
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="secondary" className={cn("bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300", className)}>
        <Clock className="size-3" />
        En cours
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn(className)}>
      <Circle className="size-3" />
      À faire
    </Badge>
  );
}
