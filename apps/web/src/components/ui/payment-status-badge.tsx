import { AlertCircle, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type PaymentStatus = "paid" | "partial" | "unpaid";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "paid") {
    return (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Check className="size-3" />
        Payé
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Clock className="size-3" />
        Partiel
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
      <AlertCircle className="size-3" />
      À payer
    </Badge>
  );
}
