import { z } from "zod";
import { requiredTextSchema, taskPrioritySchema, withDateRangeRefine } from "./shared";

const taskBaseSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  description: z.string(),
  folder: z.string(),
  status: z.enum(["todo", "in_progress", "done"]),
  priority: taskPrioritySchema,
  startDate: z.string(),
  endDate: z.string(),
  assignees: z.array(z.number()),
});

export const taskSchema = withDateRangeRefine(taskBaseSchema);
export type TaskFormValues = z.infer<typeof taskSchema>;

/** Lighter variant used by the "create task from a folder" draft dialog — derived
 * from the canonical schema so both stay in sync on shared fields. */
export const taskDraftSchema = taskBaseSchema.pick({
  title: true,
  description: true,
  priority: true,
  endDate: true,
});
export type TaskDraftFormValues = z.infer<typeof taskDraftSchema>;
