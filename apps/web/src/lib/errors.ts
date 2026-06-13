import { ApiError } from "@project-gestion/api";

export function getFieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const value = error.fieldErrors[field];
  if (Array.isArray(value)) {
    return translateError(value[0]);
  }
  if (typeof value === "string") {
    return translateError(value);
  }
  return null;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de tentatives. Reessaie plus tard.";
    }
    const detail = getFieldError(error, "detail");
    return detail ?? translateError(error.message);
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
    "errors.auth.identifier_required": "Email ou nom d'utilisateur requis.",
    "errors.token.invalid": "Session invalide.",
    "errors.email_verification.invalid_key": "Lien de verification invalide ou expire.",
    "errors.user.email_already_exists": "Un compte existe deja avec cet email.",
    "errors.user.username_already_exists": "Ce nom d'utilisateur est deja utilise.",
  };

  return messages[code] ?? code;
}

