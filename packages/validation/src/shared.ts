import { z } from "zod";

export const emailSchema = z.string().email("Adresse email invalide");

export function requiredTextSchema(message: string) {
  return z.string().min(1, message);
}

/** Required monetary amount — normalizes a comma decimal separator to a dot. */
export const amountSchema = z
  .string()
  .min(1, "Le montant est requis")
  .transform((value) => value.replace(",", "."));

export const taskPrioritySchema = z.enum(["low", "normal", "high"]);

/** Shares the "start <= end" cross-field rule across any schema whose parsed shape has startDate/endDate strings. */
export function withDateRangeRefine<Schema extends z.ZodType<{ startDate: string; endDate: string }>>(
  schema: Schema,
) {
  return schema.refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    { message: "La date de debut ne peut pas depasser la date de fin", path: ["startDate"] },
  );
}
