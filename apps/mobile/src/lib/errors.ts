import { ApiError } from "@project-gestion/api";

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de tentatives. Reessaie plus tard.";
    }
    return translateError(error.message);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur est survenue.";
}

export function isEmailVerificationRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    Array.isArray(error.fieldErrors.email) &&
    error.fieldErrors.email.includes("errors.email_verification.required")
  );
}

export function translateError(code: string) {
  const messages: Record<string, string> = {
    "errors.email_verification.required": "Ton email n'est pas encore verifie.",
    "errors.email_verification.invalid_key": "Lien de verification invalide ou expire.",
    "errors.user.email_already_exists": "Un compte existe deja avec cet email.",
  };
  return messages[code] ?? code;
}
