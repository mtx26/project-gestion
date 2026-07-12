import { format } from "date-fns";

const locale = "fr-BE";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** Convertit une date ISO (UTC, telle que renvoyee par l'API) en valeur locale
 * "yyyy-MM-ddTHH:mm" pour prefiller un champ datetime-local. */
export function toDateTimeLocalInput(value: string): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

/** Convertit une valeur locale "yyyy-MM-ddTHH:mm" saisie dans un champ
 * datetime-local en ISO UTC pour l'envoi a l'API. Une valeur nulle/vide
 * (champ optionnel, ex. Task.start_date) reste null. */
export function fromDateTimeLocalInput(value: string): string;
export function fromDateTimeLocalInput(value: string | null): string | null;
export function fromDateTimeLocalInput(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}
