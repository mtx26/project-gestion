import { z } from "zod";
import { amountSchema } from "./shared";

export const financeSchema = z.object({
  type: z.enum(["expense", "refund"]),
  amount: amountSchema,
  date: z.string(),
  category: z.string(),
  description: z.string(),
});

export type FinanceFormValues = z.infer<typeof financeSchema>;
