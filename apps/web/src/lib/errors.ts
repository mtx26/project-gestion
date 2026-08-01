import { ApiError } from "@project-gestion/api";
import type { AuthSessionResponse } from "@project-gestion/types";
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

/** django-allauth headless ne traite pas l'email non verifie comme une erreur :
 * il repond 200/401 avec une etape `verify_email` marquee `is_pending`. */
export function isEmailVerificationPending(session: AuthSessionResponse) {
  return Boolean(
    session.data.flows?.some((flow) => flow.id === "verify_email" && flow.is_pending),
  );
}

export function translateError(code: string) {
  const messages: Record<string, string> = {
    // Codes d'erreur de django-allauth (headless renvoie `code`, pas de message FR).
    account_inactive: "Ce compte est desactive.",
    email_password_mismatch: "Email ou mot de passe incorrect.",
    username_password_mismatch: "Nom d'utilisateur ou mot de passe incorrect.",
    email_taken: "Un compte existe deja avec cet email.",
    username_taken: "Ce nom d'utilisateur est deja utilise.",
    enter_current_password: "Saisis ton mot de passe actuel.",
    incorrect_password: "Mot de passe actuel incorrect.",
    invalid_or_expired_key: "Lien invalide ou expire.",
    invalid_login: "Identifiants invalides.",
    invalid_password_reset: "Lien de reinitialisation invalide ou expire.",
    too_many_login_attempts: "Trop de tentatives echouees. Reessaie plus tard.",
    unknown_email: "Aucun compte n'est associe a cet email.",
    unverified_primary_email: "Ton email principal doit etre verifie.",
    username_blacklisted: "Ce nom d'utilisateur n'est pas autorise.",
    same_as_current: "La nouvelle valeur doit etre differente de l'actuelle.",
    rate_limited: "Trop de requetes. Reessaie plus tard.",
    // Codes des validateurs de mot de passe de Django.
    password_too_short: "Le mot de passe est trop court.",
    password_too_common: "Ce mot de passe est trop courant.",
    password_too_similar: "Le mot de passe est trop proche de tes informations personnelles.",
    password_entirely_numeric: "Le mot de passe ne peut pas etre uniquement numerique.",


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

  return messages[code] ?? code;
}
