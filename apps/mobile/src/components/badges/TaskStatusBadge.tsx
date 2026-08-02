import type { Task } from "@project-gestion/types";
import { Text, View } from "react-native";

export const TASK_STATUS_LABELS: Record<Task["status"], string> = {
  todo: "A faire",
  in_progress: "En cours",
  done: "Termine",
};

// Semantic status colors have no equivalent in the neutral theme palette —
// same documented exception as web's status badges (components/badges/*).
const STATUS_STYLES: Record<Task["status"], { bg: string; text: string }> = {
  todo: { bg: "#e5e7eb", text: "#374151" },
  in_progress: { bg: "#dbeafe", text: "#1e40af" },
  done: { bg: "#dcfce7", text: "#166534" },
};

export function TaskStatusBadge({ status }: { status: Task["status"] }) {
  const style = STATUS_STYLES[status];

  return (
    <View
      style={{ backgroundColor: style.bg }}
      className="self-start rounded-full px-2.5 py-1"
    >
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {TASK_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
