import type { FinancialEntry } from "@project-gestion/types";
import { Badge } from "./Badge";
import type { BadgeTone } from "./badge-colors";

export const ENTRY_TYPE_LABELS: Record<FinancialEntry["type"], string> = {
  expense: "Depense",
  refund: "Remboursement",
};

const TYPE_TONES: Record<FinancialEntry["type"], BadgeTone> = {
  expense: "red",
  refund: "green",
};

/** Couleur de bord gauche des cartes d'ecriture financiere, pour distinguer une
 * sortie d'une entree d'argent en un coup d'oeil dans la liste.
 *
 * Ces tons moyens tiennent sur fond clair comme sur fond sombre. */
export const ENTRY_TYPE_ACCENTS: Record<FinancialEntry["type"], string> = {
  expense: "#ef4444",
  refund: "#10b981",
};

export function EntryTypeBadge({ type }: { type: FinancialEntry["type"] }) {
  return <Badge label={ENTRY_TYPE_LABELS[type]} tone={TYPE_TONES[type]} />;
}
