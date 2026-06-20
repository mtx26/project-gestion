import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function EntryTypeBadge({ type }: { type: "expense" | "refund" }) {
  if (type === "expense") {
    return (
      <Badge variant="secondary" className="shrink-0 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <Minus className="size-3" />
        Dépense
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <Plus className="size-3" />
      Remboursement
    </Badge>
  );
}
