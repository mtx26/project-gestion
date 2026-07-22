import { ApiError } from "@project-gestion/api";
import { toast } from "sonner";

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

export function getErrorMessage(error: unknown): string | null {
  if (error == null) return null;
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

export function toastError(err: unknown): void {
  toast.error(getErrorMessage(err));
}

export function isEmailVerificationRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    Array.isArray(error.fieldErrors.email) &&
    error.fieldErrors.email.includes("errors.email_verification.required")
  );
}

const PASSWORD_VALIDATOR_ATTRIBUTE_LABELS: Record<string, string> = {
  email: "l'email",
  username: "le nom d'utilisateur",
  "first name": "le prenom",
  "last name": "le nom",
};

/** Django's `validate_password()` (accounts/serializers.py) raises its own English
 * sentences rather than this app's usual `errors.xxx` codes — matched here by
 * pattern since two of them interpolate a count/attribute name. */
const PASSWORD_VALIDATOR_MESSAGES: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^This password is too short\. It must contain at least (\d+) characters?\.$/,
    (m) => `Le mot de passe doit contenir au moins ${m[1]} caracteres.`,
  ],
  [
    /^The password is too similar to the (.+)\.$/,
    (m) => `Le mot de passe est trop proche de ${PASSWORD_VALIDATOR_ATTRIBUTE_LABELS[m[1]] ?? m[1]}.`,
  ],
  [/^This password is too common\.$/, () => "Ce mot de passe est trop courant."],
  [/^This password is entirely numeric\.$/, () => "Le mot de passe ne peut pas etre uniquement numerique."],
];

export function translateError(code: string) {
  const messages: Record<string, string> = {
    "errors.email_verification.required": "Ton email n'est pas encore verifie.",
    "errors.auth.identifier_required": "Email ou nom d'utilisateur requis.",
    "errors.token.invalid": "Session invalide.",
    "errors.email_verification.invalid_key": "Lien de verification invalide ou expire.",
    "errors.user.email_already_exists": "Un compte existe deja avec cet email.",
    "errors.user.username_already_exists": "Ce nom d'utilisateur est deja utilise.",
    "errors.password.invalid_current_password": "Mot de passe actuel incorrect.",
    "errors.password_reset.invalid_token": "Lien de reinitialisation invalide ou expire.",

    "errors.task.start_date_after_end_date": "La date de debut ne peut pas depasser la date de fin.",
    "errors.task.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.task.assigned_user_not_project_member": "Cet utilisateur ne fait pas partie du projet.",

    "errors.invitation.invalid_token": "Lien d'invitation invalide.",
    "errors.invitation.already_accepted": "Cette invitation a deja ete acceptee.",
    "errors.invitation.expired": "Cette invitation a expire.",
    "errors.invitation.email_mismatch": "Cette invitation ne correspond pas a ton compte.",
    "errors.invitation.role_project_mismatch": "Ce role n'appartient pas a ce projet.",

    "errors.project_member.role_project_mismatch": "Ce role n'appartient pas a ce projet.",

    "errors.folder.parent_is_self": "Un dossier ne peut pas etre son propre parent.",
    "errors.folder.parent_project_mismatch": "Le dossier parent n'appartient pas a ce projet.",
    "errors.folder.circular_parent": "Ce dossier ne peut pas etre deplace dans l'un de ses sous-dossiers.",

    "errors.document.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.document.file_required": "Un fichier est requis.",
    "errors.document.folder_not_found": "Dossier introuvable.",
    "errors.document.file_too_large": "Le fichier depasse la taille maximale autorisee.",
    "errors.document.file_type_not_allowed": "Ce type de fichier n'est pas autorise.",

    "errors.profile_picture.file_too_large": "L'image depasse la taille maximale autorisee (5 Mo).",
    "errors.profile_picture.file_type_not_allowed": "Ce type d'image n'est pas autorise.",

    "errors.time_entry.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.time_entry.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.time_entry.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.time_entry.user_not_project_member": "Cet utilisateur ne fait pas partie du projet.",

    "errors.time_entry_payment.already_paid": "Cette entree est deja entierement payee.",
    "errors.time_entry_payment.amount_required": "Le montant est requis.",
    "errors.time_entry_payment.amount_must_be_positive": "Le montant doit etre superieur a 0.",
    "errors.time_entry_payment.amount_exceeds_remaining": "Le montant ne peut pas depasser le reste a payer.",
    "errors.time_entry_payment.amount_unchanged": "Le montant est identique au montant deja paye.",

    "errors.financial_entry.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.financial_entry.time_entry_project_mismatch": "Cette entree de temps n'appartient pas a ce projet.",
    "errors.financial_entry.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.financial_entry.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.financial_entry.amount_must_be_positive": "Le montant doit etre superieur a 0.",
    "errors.financial_entry.amount_exceeds_time_entry_remaining": "Le montant ne peut pas depasser le reste a payer.",
    "errors.financial_entry.refund_exceeds_time_entry_paid_amount": "Le remboursement ne peut pas depasser le montant deja paye.",

    "errors.expense_request.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.expense_request.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.expense_request.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.expense_request.amount_must_be_positive": "Le montant doit etre superieur a 0.",

    "errors.financial_chart.end_date_before_start_date": "La date de fin ne peut pas preceder la date de debut.",

    "errors.calendar.end_date_before_start_date": "La date de fin ne peut pas preceder la date de debut.",
    "errors.calendar_subscription.at_least_one_required": "Coche au moins taches ou temps.",
  };

  if (messages[code]) return messages[code];

  for (const [pattern, translate] of PASSWORD_VALIDATOR_MESSAGES) {
    const match = code.match(pattern);
    if (match) return translate(match);
  }

  return code;
}
