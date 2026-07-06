import { z } from "zod";

/** Required monetary amount — normalizes a comma decimal separator to a dot. */
export const amountSchema = z
  .string()
  .min(1, "Le montant est requis")
  .transform((value) => value.replace(",", "."));
