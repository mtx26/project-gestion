import type { FinancialEntry } from "@project-gestion/types";
import { Text, View } from "react-native";

export const ENTRY_TYPE_LABELS: Record<FinancialEntry["type"], string> = {
  expense: "Depense",
  refund: "Remboursement",
};

// Semantic status colors have no equivalent in the neutral theme palette —
// same documented exception as web's status badges (components/badges/*).
const TYPE_STYLES: Record<FinancialEntry["type"], { bg: string; text: string }> = {
  expense: { bg: "#fee2e2", text: "#991b1b" },
  refund: { bg: "#dcfce7", text: "#166534" },
};

/** Couleur de bord gauche des cartes d'ecriture financiere, pour distinguer une
 * sortie d'une entree d'argent en un coup d'oeil dans la liste. */
export const ENTRY_TYPE_ACCENTS: Record<FinancialEntry["type"], string> = {
  expense: "#ef4444",
  refund: "#10b981",
};

export function EntryTypeBadge({ type }: { type: FinancialEntry["type"] }) {
  const style = TYPE_STYLES[type];

  return (
    <View style={{ backgroundColor: style.bg }} className="self-start rounded-full px-2.5 py-1">
      <Text style={{ color: style.text }} className="text-xs font-semibold">
        {ENTRY_TYPE_LABELS[type]}
      </Text>
    </View>
  );
}
