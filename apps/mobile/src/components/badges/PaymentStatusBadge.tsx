import type { PaymentStatus } from "@project-gestion/domain";
import { Badge } from "./Badge";
import type { BadgeTone } from "./badge-colors";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paye",
  partial: "Partiel",
  unpaid: "Pas paye",
};

const STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  paid: "green",
  partial: "amber",
  unpaid: "orange",
};

/** Couleur de bord gauche des cartes d'entree de temps (equivalent natif de
 * `getTimeEntryCardClassName` cote web) : le statut reste lisible en un coup
 * d'oeil dans une liste, sans relire le badge.
 *
 * Ces tons moyens tiennent sur fond clair comme sur fond sombre — inutile de les
 * decliner. */
export const PAYMENT_STATUS_ACCENTS: Record<PaymentStatus, string> = {
  paid: "#10b981",
  partial: "#f59e0b",
  unpaid: "#f97316",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge label={PAYMENT_STATUS_LABELS[status]} tone={STATUS_TONES[status]} />;
}
