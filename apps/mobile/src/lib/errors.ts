import { ApiError, getFieldError, translateError } from "@project-gestion/api";

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
