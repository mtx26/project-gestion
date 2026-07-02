import type { Task } from "@project-gestion/types";
import { TASK_PRIORITY_OPTIONS } from "@/components/badges/task-priority-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ORDER: NonNullable<Task["priority"]>[] = ["low", "normal", "high"];

interface PrioritySelectProps {
  value: NonNullable<Task["priority"]>;
  onChange: (value: NonNullable<Task["priority"]>) => void;
}

/** Liste deroulante de priorite de tache, libelles partages avec TaskPriorityBadge. */
export function PrioritySelect({ value, onChange }: PrioritySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as NonNullable<Task["priority"]>)}>
      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
      <SelectContent>
        {ORDER.map((priority) => (
          <SelectItem key={priority} value={priority}>{TASK_PRIORITY_OPTIONS[priority].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
