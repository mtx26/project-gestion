import type { TimeEntry } from "@project-gestion/types";

export type PaymentStatus = "paid" | "partial" | "unpaid";

/** Statut de paiement derive des montants de l'entree : le backend n'expose pas de
 * champ dedie, la regle vit donc ici pour que web et mobile classent une entree
 * exactement pareil. */
export function getPaymentStatus(entry: Pick<TimeEntry, "paid_amount" | "remaining_amount">): PaymentStatus {
  if (Number(entry.remaining_amount) <= 0) return "paid";
  if (Number(entry.paid_amount) > 0) return "partial";
  return "unpaid";
}

/** Defaut `not_paid` : une page de suivi du temps sert d'abord a voir ce qui reste du
 * (pas paye + partiel). `all` est le seul statut qui reintegre les entrees soldees. */
export type PaymentStatusFilter = "all" | "unpaid" | "partial" | "paid" | "not_paid";

export const defaultPaymentStatusFilter: PaymentStatusFilter = "not_paid";

export function parsePaymentStatusFilter(value: string | null | undefined): PaymentStatusFilter {
  if (value === "unpaid" || value === "partial" || value === "paid" || value === "all") return value;
  return defaultPaymentStatusFilter;
}

/** Part payee d'une entree, en pourcentage borne a 100 — une entree sans cout est
 * consideree soldee (rien a payer). */
export function getPaidRatio(entry: Pick<TimeEntry, "cost_amount" | "paid_amount">): number {
  const costAmount = Number(entry.cost_amount);
  if (costAmount <= 0) return 100;
  return Math.min(100, (Number(entry.paid_amount) / costAmount) * 100);
}

/** Duree entre deux instants, en minutes entieres et jamais negative — la valeur que
 * les formulaires de temps envoient comme `duration_minutes`. */
export function getDurationMinutes(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000));
}
