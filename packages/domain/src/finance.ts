import type { FinancialEntry } from "@project-gestion/types";

/** Origine d'une ecriture : saisie a la main, ou generee par le paiement d'heures. */
export const FINANCIAL_SOURCE_LABELS: Record<FinancialEntry["source"], string> = {
  manual: "Manuel",
  labor: "Main d'œuvre",
};

/** "2026-03" -> "Mar 26" : libelle court d'une periode du graphique finances. Ecrit a
 * la main plutot qu'avec `Intl` — mobile ne peut pas compter sur les donnees ICU. */
export function formatFinancePeriod(period: string): string {
  const [year, month] = period.split("-");
  if (year && month) {
    const names = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year.slice(2)}`;
  }
  return period;
}

/** Montant signe d'une ecriture : une depense sort de la caisse, un remboursement y rentre. */
export function getSignedAmount(entry: Pick<FinancialEntry, "type" | "amount">): number {
  const amount = Number(entry.amount);
  return entry.type === "expense" ? -amount : amount;
}
