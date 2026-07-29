import { z } from "zod";
import { descriptionSchema, orNull, requiredTextSchema, taskPrioritySchema, withDateRangeRefine } from "./shared";
import type { FieldMapping } from "./server-fields";

const taskBaseSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  description: descriptionSchema,
  folder: z.string(),
  status: z.enum(["todo", "in_progress", "done"]),
  priority: taskPrioritySchema,
  startDate: orNull(z.string()),
  endDate: orNull(z.string()),
  assignees: z.array(z.number()),
});

export const taskSchema = withDateRangeRefine(taskBaseSchema);
export type TaskFormValues = z.output<typeof taskSchema>;
export type TaskFormInput = z.input<typeof taskSchema>;

export const taskFieldMap: FieldMapping<TaskFormInput>[] = [
  "title",
  "priority",
  { name: "folder", serverField: "folder" },
  { name: "startDate", serverField: "start_date" },
  { name: "endDate", serverField: "end_date" },
  { name: "assignees", serverField: "assigned_to" },
];

/** Lighter variant used by the "create task from a folder" draft dialog — derived
 * from the canonical schema so both stay in sync on shared fields. */
export const taskDraftSchema = taskBaseSchema.pick({
  title: true,
  description: true,
  priority: true,
  endDate: true,
});
export type TaskDraftFormValues = z.output<typeof taskDraftSchema>;
export type TaskDraftFormInput = z.input<typeof taskDraftSchema>;
