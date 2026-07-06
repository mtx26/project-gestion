import type { TimeEntry } from "@project-gestion/types";
import type { PaymentStatus } from "@/components/badges/payment-status-badge";

export function getPaymentStatus(entry: TimeEntry): PaymentStatus {
  if (Number(entry.remaining_amount) <= 0) return "paid";
  if (Number(entry.paid_amount) > 0) return "partial";
  return "unpaid";
}
