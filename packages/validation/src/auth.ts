import { z } from "zod";
import { emailSchema, requiredTextSchema } from "./shared";
import type { FieldMapping } from "./server-fields";

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caracteres")
  .regex(/[A-Z]/, "Ajoute au moins une majuscule")
  .regex(/[a-z]/, "Ajoute au moins une minuscule")
  .regex(/[0-9]/, "Ajoute au moins un chiffre");

/** Matches Django's `User.first_name`/`last_name` (`max_length=150`) — narrower
 * than the 255 most other name/title fields use, so it can't reuse the default. */
export const personNameSchema = (message: string) => requiredTextSchema(message, 150);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email ou nom d'utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  key: z.string().min(1, "Cle de verification manquante"),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordConfirmSchema = z.object({
  uid: z.string().min(1, "Identifiant manquant"),
  token: z.string().min(1, "Token manquant"),
  new_password: passwordSchema,
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, "Mot de passe actuel requis"),
  new_password: passwordSchema,
});

export type SignupFormValues = z.infer<typeof signupSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ResendVerificationFormValues = z.infer<typeof resendVerificationSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmFormValues = z.infer<typeof resetPasswordConfirmSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// Server-field mappings for useServerFieldErrors — shared so web and mobile
// map a 400 response onto the same form fields instead of hand-copying the
// same array per platform.
export const loginFieldMap: FieldMapping<LoginFormValues>[] = [
  "identifier",
  { name: "identifier", serverField: "username" },
  "password",
];
export const resendVerificationFieldMap: FieldMapping<ResendVerificationFormValues>[] = ["email"];
export const resetPasswordFieldMap: FieldMapping<ResetPasswordFormValues>[] = ["email"];
export const resetPasswordConfirmFieldMap: FieldMapping<ResetPasswordConfirmFormValues>[] = [
  "uid",
  "token",
  "new_password",
];
