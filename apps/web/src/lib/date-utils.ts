const locale = "fr-BE";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
