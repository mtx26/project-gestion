import { z } from "zod";
import { amountSchema, descriptionSchema, withDateRangeRefine } from "./shared";

const timeEntryBaseSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  hourlyRate: z.string(),
  description: descriptionSchema,
});

/** `hourlyRate` only becomes `undefined` when empty on the full entry form — the
 * draft variant below picks the field from `timeEntryBaseSchema` *before* this
 * runs, since `TimeDraftSubmitData.hourlyRate` is a required `string`. */
export const timeEntrySchema = withDateRangeRefine(timeEntryBaseSchema).transform((v) => ({
  ...v,
  hourlyRate: v.hourlyRate || undefined,
}));
export type TimeEntryFormValues = z.output<typeof timeEntrySchema>;
export type TimeEntryFormInput = z.input<typeof timeEntrySchema>;

/** `remaining` bounds the partial-payment amount, so the schema is built per dialog instance. */
export function makePaymentSchema(remaining: number) {
  return z
    .object({
      mode: z.enum(["full", "partial"]),
      amount: amountSchema,
    })
    .refine((v) => v.mode !== "partial" || Number(v.amount) > 0, {
      message: "Le montant doit etre superieur a 0",
      path: ["amount"],
    })
    .refine((v) => v.mode !== "partial" || Number(v.amount) <= remaining, {
      message: "Le montant ne peut pas depasser le reste a payer",
      path: ["amount"],
    });
}
export type PaymentFormValues = z.infer<ReturnType<typeof makePaymentSchema>>;

export function makeCorrectionSchema(costAmount: number, paidAmount: number) {
  return z
    .object({ amount: amountSchema })
    .refine((v) => Number(v.amount) >= 0, {
      message: "Le montant ne peut pas etre negatif",
      path: ["amount"],
    })
    .refine((v) => Number(v.amount) <= costAmount, {
      message: "Le montant ne peut pas depasser le cout total",
      path: ["amount"],
    })
    .refine((v) => Number(v.amount) !== paidAmount, {
      message: "Le montant est identique au montant deja paye",
      path: ["amount"],
    });
}
export type CorrectionFormValues = z.infer<ReturnType<typeof makeCorrectionSchema>>;

/** Draft variant (duration entered as hours/minutes rather than a date range) —
 * shares its monetary/description fields with the canonical schema via `.pick()`. */
export const timeDraftSchema = timeEntryBaseSchema
  .pick({ hourlyRate: true, description: true })
  .extend({ hours: z.string(), minutes: z.string() })
  .refine((v) => Number(v.hours) * 60 + Number(v.minutes) > 0, {
    message: "La duree doit etre superieure a 0",
    path: ["hours"],
  });
export type TimeDraftFormValues = z.output<typeof timeDraftSchema>;
export type TimeDraftFormInput = z.input<typeof timeDraftSchema>;
