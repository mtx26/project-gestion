import { AlertCircle, Check, Clock } from "lucide-react";
import { StatusBadge, type BadgeOption } from "./status-badge";

export type PaymentStatus = "paid" | "partial" | "unpaid";

const OPTIONS: Record<PaymentStatus, BadgeOption> = {
  paid:    { label: "Payé",    icon: Check,       className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  partial: { label: "Partiel", icon: Clock,       className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  unpaid:  { label: "À payer", icon: AlertCircle, className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
};

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <StatusBadge option={OPTIONS[status]} className={className} />;
}
