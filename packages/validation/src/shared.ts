import { z } from "zod";

export const emailSchema = z.string().email("Adresse email invalide");

/** Required single-line text — mirrors the backend's `CharField(max_length=255)`,
 * the length every name/title field in the API (Project, Role, Folder, Document,
 * Task, ExpenseRequest…) shares, so a value Zod accepts can never be rejected by
 * the backend on length alone. Pass `maxLength`/`minLength` only for a field with
 * a different bound (e.g. Project.name requires 2 characters, not 1).
 *
 * `.trim()` runs before `.min()`, so whitespace-only input is rejected here
 * instead of passing Zod (raw length > 0) and only becoming empty after each
 * submit handler used to trim it by hand right before sending the payload. */
export function requiredTextSchema(message: string, maxLength = 255, minLength = 1) {
  return z.string().trim().min(minLength, message).max(maxLength, `Ne peut pas depasser ${maxLength} caracteres`);
}

/** Wraps a string schema so an empty result becomes `null` — the API's "no value"
 * representation for every optional field (description, category, dates…).
 * Applied inside the schema (not by hand in each submit handler) so a submit
 * handler never has to know which fields are "nullable when empty". Changes the
 * field's output type to `string | null`, so a form using it needs `useForm`'s
 * 3-generic form (`useForm<Input, Context, Output>`) — see any `<Feature>FormDialog`. */
export function orNull<Schema extends z.ZodType<string, any>>(schema: Schema) {
  return schema.transform((v) => v || null);
}

/** Same as `orNull`, but for the rarer case where the API expects the field
 * omitted (`undefined`) rather than `null` when empty — e.g. `TimeEntryPayload.hourly_rate`. */
export function orUndefined<Schema extends z.ZodType<string, any>>(schema: Schema) {
  return schema.transform((v) => v || undefined);
}

/** Optional free text (description, notes…) — trimmed, and empty becomes `null`
 * for the API payload. */
export const descriptionSchema = orNull(z.string().trim());

/** Normalizes a comma decimal separator to a dot — the one place this rule is
 * written, shared by `amountSchema` and any raw (non-RHF) money input, like the
 * inline hourly-rate editors in `MembersSettingsTab`, so a value never reaches
 * the backend's `Decimal(...)` parsing with a comma still in it. */
export function normalizeAmountInput(value: string) {
  return value.replace(",", ".");
}

/** Required monetary amount — normalizes a comma decimal separator to a dot. */
export const amountSchema = z
  .string()
  .min(1, "Le montant est requis")
  .transform(normalizeAmountInput);

/** Same as `amountSchema`, plus the ">0" business rule the backend enforces for
 * financial entries and expense requests (via `validate_amount`) — unlike a
 * payment/correction amount, which can legitimately be zero, so this is not
 * folded into `amountSchema` itself. */
export const positiveAmountSchema = amountSchema.refine(
  (v) => Number(v) > 0,
  { message: "Le montant doit etre superieur a 0" },
);

export const taskPrioritySchema = z.enum(["low", "normal", "high"]);

/** Optional short text — mirrors the backend's `CharField(max_length=100, blank=True)`
 * used for a category label (FinancialEntry, ExpenseRequest). Empty becomes `null`. */
export const categorySchema = orNull(z.string().trim().max(100, "Ne peut pas depasser 100 caracteres"));

/** Shares the "start <= end" cross-field rule across any schema whose parsed shape has
 * startDate/endDate strings — `| null` covers fields wrapped in `orNull` (e.g. Task's
 * optional dates); a plain required `string` (e.g. TimeEntry's) satisfies it too. */
export function withDateRangeRefine<Schema extends z.ZodType<{ startDate: string | null; endDate: string | null }>>(
  schema: Schema,
) {
  return schema.refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    { message: "La date de debut ne peut pas depasser la date de fin", path: ["startDate"] },
  );
}
