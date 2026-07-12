import { z } from "zod";
import { descriptionSchema, requiredTextSchema, taskPrioritySchema, withDateRangeRefine } from "./shared";

const dayEntryPersonSchema = z.object({
  userId: z.number(),
  hourlyRate: z.string(),
});

const dayEntryBaseSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  description: descriptionSchema,
  folder: z.string(),
  priority: taskPrioritySchema,
  startDate: z.string(),
  endDate: z.string(),
  entries: z.array(dayEntryPersonSchema).min(1, "Ajoute au moins une personne"),
});

export const dayEntrySchema = withDateRangeRefine(dayEntryBaseSchema);

export type DayEntryFormValues = z.output<typeof dayEntrySchema>;
export type DayEntryFormInput = z.input<typeof dayEntrySchema>;
