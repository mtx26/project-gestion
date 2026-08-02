import { z } from "zod";
import { descriptionSchema, requiredTextSchema } from "./shared";
import type { FieldMapping } from "./server-fields";

export const projectSchema = z.object({
  name: requiredTextSchema("Le nom doit contenir au moins 2 caracteres", 255, 2),
  description: descriptionSchema,
});

export type ProjectFormValues = z.output<typeof projectSchema>;
export type ProjectFormInput = z.input<typeof projectSchema>;

export const projectFieldMap: FieldMapping<ProjectFormInput>[] = ["name", "description"];
