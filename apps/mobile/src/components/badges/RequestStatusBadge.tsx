import type { ExpenseRequest } from "@project-gestion/types";
import { Text, View } from "react-native";

export const REQUEST_STATUS_LABELS: Record<ExpenseRequest["status"], string> = {
  pending: "En attente",
  approved: "Approuve",
  rejected: "Refuse",
};

// Semantic status colors have no equivalent in the neutral theme palette —
// same documented exception as web's status badges (components/badges/*).
const STATUS_STYLES: Record<ExpenseRequest["status"], { bg: string; text: string }> = {
  pending: { bg: "#fef9c3", text: "#854d0e" },
  approved: { bg: "#dcfce7", text: "#166534" },
  rejected: { bg: "#fee2e2", text: "#991b1b" },
};

export function RequestStatusBadge({ status }: { status: ExpenseRequest["status"] }) {
  const style = STATUS_STYLES[status];

  return (
    <View style={{ backgroundColor: style.bg }} className="self-start rounded-full px-2.5 py-1">
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {REQUEST_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
