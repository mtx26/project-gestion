export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDuration(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}
