import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  description: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
