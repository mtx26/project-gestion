import type { Task } from "@project-gestion/types";
import { Text, View } from "react-native";

export const TASK_PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
};

const PRIORITY_STYLES: Record<Task["priority"], { bg: string; text: string }> = {
  low: { bg: "#f1f5f9", text: "#475569" },
  normal: { bg: "#e0e7ff", text: "#3730a3" },
  high: { bg: "#fee2e2", text: "#991b1b" },
};

export function TaskPriorityBadge({ priority }: { priority: Task["priority"] }) {
  const style = PRIORITY_STYLES[priority];

  return (
    <View
      style={{ backgroundColor: style.bg }}
      className="self-start rounded-full px-2.5 py-1"
    >
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {TASK_PRIORITY_LABELS[priority]}
      </Text>
    </View>
  );
}
