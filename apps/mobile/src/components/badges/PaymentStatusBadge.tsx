import { Text, View } from "react-native";
import type { PaymentStatus } from "@project-gestion/domain";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paye",
  partial: "Partiel",
  unpaid: "Pas paye",
};

// Semantic status colors have no equivalent in the neutral theme palette —
// same documented exception as web's status badges (components/badges/*).
const STATUS_STYLES: Record<PaymentStatus, { bg: string; text: string }> = {
  paid: { bg: "#dcfce7", text: "#166534" },
  partial: { bg: "#fef3c7", text: "#92400e" },
  unpaid: { bg: "#ffedd5", text: "#9a3412" },
};

/** Couleur de bord gauche des cartes d'entree de temps (equivalent natif de
 * `getTimeEntryCardClassName` cote web) : le statut reste lisible en un coup
 * d'oeil dans une liste, sans relire le badge. */
export const PAYMENT_STATUS_ACCENTS: Record<PaymentStatus, string> = {
  paid: "#10b981",
  partial: "#f59e0b",
  unpaid: "#f97316",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View style={{ backgroundColor: style.bg }} className="self-start rounded-full px-2.5 py-1">
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {PAYMENT_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
