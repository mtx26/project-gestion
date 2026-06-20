import { Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExpenseRequest } from "@project-gestion/types";

export function RequestStatusBadge({ status }: { status: ExpenseRequest["status"] }) {
  if (status === "approved") {
    return (
      <Badge variant="secondary" className="shrink-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Check className="size-3" />
        Approuvé
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="secondary" className="shrink-0 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <X className="size-3" />
        Refusé
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
      <Clock className="size-3" />
      En attente
    </Badge>
  );
}
