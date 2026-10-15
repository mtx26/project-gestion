import type { Task } from "@project-gestion/types";
import { Badge } from "./Badge";
import type { BadgeTone } from "./badge-colors";

export const TASK_STATUS_LABELS: Record<Task["status"], string> = {
  todo: "A faire",
  in_progress: "En cours",
  done: "Termine",
};

const STATUS_TONES: Record<Task["status"], BadgeTone> = {
  todo: "grey",
  in_progress: "blue",
  done: "green",
};

export function TaskStatusBadge({ status }: { status: Task["status"] }) {
  return <Badge label={TASK_STATUS_LABELS[status]} tone={STATUS_TONES[status]} />;
}
