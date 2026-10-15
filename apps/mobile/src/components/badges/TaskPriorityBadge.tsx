import type { Task } from "@project-gestion/types";
import { Badge } from "./Badge";
import type { BadgeTone } from "./badge-colors";

export const TASK_PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
};

const PRIORITY_TONES: Record<Task["priority"], BadgeTone> = {
  low: "slate",
  normal: "indigo",
  high: "red",
};

export function TaskPriorityBadge({ priority }: { priority: Task["priority"] }) {
  return <Badge label={TASK_PRIORITY_LABELS[priority]} tone={PRIORITY_TONES[priority]} />;
}
