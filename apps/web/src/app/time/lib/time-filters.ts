import type { TimeEntry } from "@project-gestion/types";
import { detectPreset, getPeriodLabel } from "@/lib/period-utils";

/** `"none"` cible les entrees orphelines (titulaire supprime), visibles seulement avec
 * `time_entry.view_all` comme les entrees des autres membres. */
export type UserFilter = "mine" | "all" | "none" | `member-${number}`;
export type PaymentStatusFilter = "all" | "unpaid" | "partial" | "paid" | "not_paid";

export function parseUserFilter(value: string | null, fallback: UserFilter, canViewAllTime: boolean): UserFilter {
  if (value === "all" && canViewAllTime) return "all";
  if (value === "none" && canViewAllTime) return "none";
  if (value?.startsWith("member-") && canViewAllTime) {
    const userId = Number(value.replace("member-", ""));
    return Number.isFinite(userId) && userId > 0 ? `member-${userId}` : fallback;
  }
  if (value === "mine") return "mine";
  return fallback;
}

/** Defaut `not_paid` : la page sert d'abord a suivre ce qui reste du (pas paye + partiel).
 * `all` est le seul statut qui reintegre les entrees soldees. */
export function parsePaymentStatusFilter(value: string | null): PaymentStatusFilter {
  if (value === "unpaid" || value === "partial" || value === "paid" || value === "all") return value;
  return "not_paid";
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


export function getSelectedUserId(filter: UserFilter, currentUserId: number | null): number | "none" | null {
  if (filter === "all") return null;
  if (filter === "none") return "none";
  if (filter === "mine") return currentUserId;
  return Number(filter.replace("member-", ""));
}

export function getPaymentStatusLabel(status: Exclude<PaymentStatusFilter, "all">): string {
  if (status === "paid") return "Paye";
  if (status === "partial") return "Partiel";
  if (status === "not_paid") return "Non regle";
  return "Pas paye";
}

export function getTimeEntryCardClassName(status: "paid" | "partial" | "unpaid"): string {
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
      : userFilter === "none"
        ? "non attribue"
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
