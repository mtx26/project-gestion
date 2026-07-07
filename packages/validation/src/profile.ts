import { z } from "zod";
import { personNameSchema } from "./auth";
import { requiredTextSchema } from "./shared";

/** Matches Django's `User.username` (`max_length=150`, required — no `blank=True`). */
export const accountProfileSchema = z.object({
  username: requiredTextSchema("Le nom d'utilisateur est requis", 150),
  first_name: personNameSchema("Le prenom est requis"),
  last_name: personNameSchema("Le nom est requis"),
  default_hourly_rate: z.string().transform((v) => v || "0"),
});

export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>;
