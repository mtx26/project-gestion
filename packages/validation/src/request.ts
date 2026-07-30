import { z } from "zod";
import { categorySchema, descriptionSchema, positiveAmountSchema, requiredTextSchema } from "./shared";
import type { FieldMapping } from "./server-fields";

export const requestSchema = z.object({
  title: requiredTextSchema("Le titre est requis"),
  amount: positiveAmountSchema,
  category: categorySchema,
  description: descriptionSchema,
});

export type RequestFormValues = z.output<typeof requestSchema>;
export type RequestFormInput = z.input<typeof requestSchema>;

export const requestFieldMap: FieldMapping<RequestFormInput>[] = ["title", "amount", "category", "description"];
