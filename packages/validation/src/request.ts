import { z } from "zod";
import { categorySchema, descriptionSchema, positiveAmountSchema, requiredTextSchema } from "./shared";

export const requestSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  amount: positiveAmountSchema,
  category: categorySchema,
  description: descriptionSchema,
});

export type RequestFormValues = z.output<typeof requestSchema>;
export type RequestFormInput = z.input<typeof requestSchema>;
