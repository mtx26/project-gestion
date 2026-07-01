import type { TimeEntry } from "@project-gestion/types";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@project-gestion/query-keys";
import { detectPreset, formatDate, getPeriodLabel } from "@/lib/period-utils";

export type UserFilter = "mine" | "all" | `member-${number}`;
export type PaymentStatusFilter = "all" | "unpaid" | "partial" | "paid";
export type TimeViewMode = "list" | "calendar";



export function parseUserFilter(value: string | null, fallback: UserFilter, canViewAllTime: boolean): UserFilter {
  if (value === "all" && canViewAllTime) return "all";
  if (value?.startsWith("member-") && canViewAllTime) {
    const userId = Number(value.replace("member-", ""));
    return Number.isFinite(userId) && userId > 0 ? `member-${userId}` : fallback;
  }
  if (value === "mine") return "mine";
  return fallback;
}

export function parsePaymentStatusFilter(value: string | null): PaymentStatusFilter {
  if (value === "unpaid" || value === "partial" || value === "paid") return value;
  return "all";
}

export function parseTimeViewMode(value: string | null): TimeViewMode {
  return value === "calendar" ? "calendar" : "list";
}

export function parseTargetFilter(value: string | null): string | null {
  if (value === "project") return "project";
  if (value?.startsWith("folder-")) {
    const id = Number(value.replace("folder-", ""));
    return Number.isFinite(id) && id > 0 ? `folder-${id}` : null;
  }
  if (value?.startsWith("task-")) {
    const id = Number(value.replace("task-", ""));
    return Number.isFinite(id) && id > 0 ? `task-${id}` : null;
  }
  return null;
}


export function getSelectedUserId(filter: UserFilter, currentUserId: number | null): number | null {
  if (filter === "all") return null;
  if (filter === "mine") return currentUserId;
  return Number(filter.replace("member-", ""));
}

export function getPaymentStatus(entry: TimeEntry): Exclude<PaymentStatusFilter, "all"> {
  if (Number(entry.remaining_amount) <= 0) return "paid";
  if (Number(entry.paid_amount) > 0) return "partial";
  return "unpaid";
}

export function getPaymentStatusLabel(status: Exclude<PaymentStatusFilter, "all">): string {
  if (status === "paid") return "Paye";
  if (status === "partial") return "Partiel";
  return "A payer";
}

export function getTimeEntryCardClassName(status: Exclude<PaymentStatusFilter, "all">): string {
  const base = "rounded-md border bg-card p-4 text-sm";
  if (status === "paid") return `${base} border-l-4 border-l-emerald-500`;
  if (status === "partial") return `${base} border-l-4 border-l-amber-500`;
  return `${base} border-l-4 border-l-orange-500`;
}

export function getEntryTargetLabel(entry: TimeEntry): string {
  if (entry.task != null) return entry.task_name ?? "Tache liee";
  if (entry.folder != null) return entry.folder_name ?? "Dossier lie";
  return "Projet";
}

export function getTotalsLabel(
  userFilter: UserFilter,
  paymentStatusFilter: PaymentStatusFilter,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  members: Array<{ user: number; user_display_name: string }>,
  currentUserId: number | null,
  targetLabel: string | null,
): string {
  const userLabel =
    userFilter === "all"
      ? "tous les membres"
      : userFilter === "mine"
        ? "mes heures"
        : (members.find((m) => m.user === getSelectedUserId(userFilter, currentUserId))?.user_display_name ?? "membre");
  const statusLabel = paymentStatusFilter === "all" ? "tous statuts" : getPaymentStatusLabel(paymentStatusFilter).toLowerCase();
  const detected = detectPreset(dateFrom, dateTo);
  const periodLabel = detected === "custom"
    ? (dateFrom ? `${dateFrom}${dateTo ? ` → ${dateTo}` : ""}` : "toutes dates")
    : getPeriodLabel(detected).toLowerCase();
  const targetSuffix = targetLabel ? ` - ${targetLabel}` : "";
  return `Totaux - ${periodLabel} - ${userLabel} - ${statusLabel}${targetSuffix}`;
}

export function filterTimeEntriesByPaymentStatus(entries: TimeEntry[], filter: PaymentStatusFilter): TimeEntry[] {
  if (filter === "all") return entries;
  return entries.filter((entry) => getPaymentStatus(entry) === filter);
}

export function filterTimeEntriesByTarget(
  entries: TimeEntry[],
  target: string | null,
  taskFolderById: Map<number, number>,
  descendantFolderIds: Set<number> | null,
): TimeEntry[] {
  if (!target) return entries;
  if (target === "project") return entries.filter((entry) => entry.folder == null && entry.task == null);
  if (target.startsWith("folder-")) {
    const folderIds = descendantFolderIds ?? new Set([Number(target.replace("folder-", ""))]);
    return entries.filter(
      (entry) =>
        (entry.folder != null && folderIds.has(entry.folder)) ||
        (entry.task != null && folderIds.has(taskFolderById.get(entry.task) ?? -1)),
    );
  }
  if (target.startsWith("task-")) {
    const taskId = Number(target.replace("task-", ""));
    return entries.filter((entry) => entry.task === taskId);
  }
  return entries;
}

export function summarizeTimeEntries(entries: TimeEntry[]): { durationMinutes: number; costAmount: number; remainingAmount: number } {
  return entries.reduce(
    (total, entry) => ({
      durationMinutes: total.durationMinutes + entry.duration_minutes,
      costAmount: total.costAmount + Number(entry.cost_amount),
      remainingAmount: total.remainingAmount + Number(entry.remaining_amount),
    }),
    { durationMinutes: 0, costAmount: 0, remainingAmount: 0 },
  );
}

export function groupTimeEntriesByDay(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const groups = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = formatDate(new Date(entry.created_at));
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const [key, dayEntries] of groups.entries()) {
    groups.set(key, dayEntries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }
  return groups;
}

export function getCalendarMonthDate(dateValue: string | undefined, entries: TimeEntry[]): Date {
  if (dateValue) return new Date(`${dateValue}T12:00:00`);
  if (entries[0]) return new Date(entries[0].created_at);
  return new Date();
}

export function getMonthCalendarDays(monthDate: Date): Date[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export async function invalidateTimeQueries(queryClient: QueryClient, projectId: number): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all(projectId) });
}
