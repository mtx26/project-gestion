import { z } from "zod";
import { descriptionSchema, orNull, positiveAmountSchema } from "./shared";

export const financeSchema = z.object({
  type: z.enum(["expense", "refund"]),
  amount: positiveAmountSchema,
  date: orNull(z.string()),
  description: descriptionSchema,
});

export type FinanceFormValues = z.output<typeof financeSchema>;
export type FinanceFormInput = z.input<typeof financeSchema>;
