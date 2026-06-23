import { Check, Clock, X } from "lucide-react";
import type { ExpenseRequest } from "@project-gestion/types";
import { StatusBadge, type BadgeOption } from "./status-badge";

const OPTIONS: Record<ExpenseRequest["status"], BadgeOption> = {
  approved: { label: "Approuvé",   icon: Check, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "Refusé",     icon: X,     className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  pending:  { label: "En attente", icon: Clock, className: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
};

export function RequestStatusBadge({ status, className }: { status: ExpenseRequest["status"]; className?: string }) {
  return <StatusBadge option={OPTIONS[status]} className={className} />;
}
