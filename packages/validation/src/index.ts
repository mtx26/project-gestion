import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caracteres.")
  .regex(/[A-Z]/, "Ajoute au moins une majuscule.")
  .regex(/[a-z]/, "Ajoute au moins une minuscule.")
  .regex(/[0-9]/, "Ajoute au moins un chiffre.");

export const registerSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: passwordSchema,
  first_name: z.string().min(1, "Le prenom est requis."),
  last_name: z.string().min(1, "Le nom est requis."),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email ou nom d'utilisateur requis."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Adresse email invalide."),
});

export const verifyEmailSchema = z.object({
  key: z.string().min(1, "Cle de verification manquante."),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide."),
});

export const resetPasswordConfirmSchema = z.object({
  uid: z.string().min(1, "Identifiant manquant."),
  token: z.string().min(1, "Token manquant."),
  new_password: passwordSchema,
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, "Mot de passe actuel requis."),
  new_password: passwordSchema,
});

export const projectSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres."),
  description: z.string().optional(),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ResendVerificationFormValues = z.infer<typeof resendVerificationSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmFormValues = z.infer<typeof resetPasswordConfirmSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type ProjectFormValues = z.infer<typeof projectSchema>;

