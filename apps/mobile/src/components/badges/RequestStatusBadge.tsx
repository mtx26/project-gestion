import type { ExpenseRequest } from "@project-gestion/types";
import { Badge } from "./Badge";
import type { BadgeTone } from "./badge-colors";

export const REQUEST_STATUS_LABELS: Record<ExpenseRequest["status"], string> = {
  pending: "En attente",
  approved: "Approuve",
  rejected: "Refuse",
};

const STATUS_TONES: Record<ExpenseRequest["status"], BadgeTone> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
};

export function RequestStatusBadge({ status }: { status: ExpenseRequest["status"] }) {
  return <Badge label={REQUEST_STATUS_LABELS[status]} tone={STATUS_TONES[status]} />;
}
