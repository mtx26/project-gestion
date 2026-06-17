import type { Task } from "@project-gestion/types";

export function getStatusLabel(status: Task["status"]) {
  if (status === "in_progress") return "En cours";
  if (status === "done") return "Termine";
  return "A faire";
}

export function getPriorityLabel(priority: Task["priority"]) {
  if (priority === "high") return "Haute";
  if (priority === "low") return "Basse";
  return "Normale";
}

export function getStatusClassName(status: Task["status"]) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-muted bg-background text-muted-foreground";
}

export function getPriorityClassName(priority: Task["priority"]) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "low") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDuration(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}
