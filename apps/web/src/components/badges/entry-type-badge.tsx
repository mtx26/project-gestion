import { Minus, Plus } from "lucide-react";
import { StatusBadge, type BadgeOption } from "./status-badge";

type EntryType = "expense" | "refund";

const OPTIONS: Record<EntryType, BadgeOption> = {
  expense: { label: "Dépense",        icon: Minus, className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  refund:  { label: "Remboursement",  icon: Plus,  className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function EntryTypeBadge({ type, className }: { type: EntryType; className?: string }) {
  return <StatusBadge option={OPTIONS[type]} className={className} />;
}
