import { z } from "zod";
import { amountSchema, requiredTextSchema } from "./shared";

export const requestSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  amount: amountSchema,
  category: z.string(),
  description: z.string(),
});

export type RequestFormValues = z.infer<typeof requestSchema>;
