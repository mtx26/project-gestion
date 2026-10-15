import type { PaymentStatusFilter } from "@project-gestion/domain";
import type { ProjectMember } from "@project-gestion/types";
import { formatDate } from "../../../lib/date-format";

/** Libelles du filtre de statut de paiement, dans l'ordre d'affichage. Le defaut
 * (`not_paid`) et les valeurs elles-memes viennent de `@project-gestion/domain` :
 * seuls les libelles sont propres a cette app. */
export const PAYMENT_STATUS_OPTIONS: { label: string; value: PaymentStatusFilter }[] = [
  { label: "Non regle", value: "not_paid" },
  { label: "Pas paye", value: "unpaid" },
  { label: "Partiel", value: "partial" },
  { label: "Paye", value: "paid" },
  { label: "Tous statuts", value: "all" },
];

/** Titulaire filtre : `null` = tous les membres, `"none"` = entrees orphelines
 * (compte supprime), sinon l'identifiant du membre. */
export type UserFilter = number | "none" | null;

export function getPaymentStatusFilterLabel(filter: PaymentStatusFilter): string {
  return PAYMENT_STATUS_OPTIONS.find((option) => option.value === filter)?.label ?? "";
}

export function getUserFilterLabel(
  filter: UserFilter,
  members: ProjectMember[],
  currentUserId: number | null,
): string {
  if (filter == null) return "Tous les membres";
  if (filter === "none") return "Non attribue";
  if (filter === currentUserId) return "Mes heures";
  return members.find((member) => member.user === filter)?.user_display_name ?? "Membre";
}

function getPeriodLabel(dateFrom: string | undefined, dateTo: string | undefined): string {
  if (!dateFrom && !dateTo) return "toutes dates";
  if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  if (dateFrom) return `depuis le ${formatDate(dateFrom)}`;
  return `jusqu'au ${formatDate(dateTo as string)}`;
}

/** Rappelle a quoi correspondent les totaux affiches : ils suivent les filtres, donc
 * un montant sans son scope ne veut rien dire (meme role que `getTotalsLabel` cote web). */
export function buildTotalsLabel({
  userFilter,
  paymentStatusFilter,
  dateFrom,
  dateTo,
  members,
  currentUserId,
  targetLabel,
}: {
  userFilter: UserFilter;
  paymentStatusFilter: PaymentStatusFilter;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  members: ProjectMember[];
  currentUserId: number | null;
  targetLabel: string | null;
}): string {
  const parts = [
    getPeriodLabel(dateFrom, dateTo),
    getUserFilterLabel(userFilter, members, currentUserId).toLowerCase(),
    getPaymentStatusFilterLabel(paymentStatusFilter).toLowerCase(),
  ];
  return `Totaux - ${parts.join(" - ")}${targetLabel ? ` - ${targetLabel}` : ""}`;
}
