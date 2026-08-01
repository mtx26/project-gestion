import { ApiError } from "@project-gestion/api";

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de tentatives. Reessaie plus tard.";
    }
    // Les codes d'allauth arrivent dans `fieldErrors` (sous `detail` quand l'erreur
    // ne vise aucun champ) ; `message` reste le libelle brut, en anglais.
    const code = firstErrorCode(error);
    return translateError(code ?? error.message);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur est survenue.";
}

function firstErrorCode(error: ApiError) {
  const detail = error.fieldErrors.detail ?? Object.values(error.fieldErrors)[0];
  if (Array.isArray(detail)) return typeof detail[0] === "string" ? detail[0] : null;
  return typeof detail === "string" ? detail : null;
}

export function translateError(code: string) {
  const messages: Record<string, string> = {
    // Codes d'erreur de django-allauth headless.
    email_password_mismatch: "Email ou mot de passe incorrect.",
    username_password_mismatch: "Nom d'utilisateur ou mot de passe incorrect.",
    email_taken: "Un compte existe deja avec cet email.",
    invalid_or_expired_key: "Lien invalide ou expire.",
    invalid_password_reset: "Lien de reinitialisation invalide ou expire.",
    too_many_login_attempts: "Trop de tentatives echouees. Reessaie plus tard.",
    unknown_email: "Aucun compte n'est associe a cet email.",
  };
  return messages[code] ?? code;
}

