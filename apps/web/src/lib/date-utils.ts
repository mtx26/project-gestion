const locale = "fr-BE";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatCalendarMonth(value: Date) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(value);
}
