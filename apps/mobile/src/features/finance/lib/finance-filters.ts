import type { FinancialEntry } from "@project-gestion/types";

export type TypeFilter = "all" | FinancialEntry["type"];
export type SourceFilter = "all" | FinancialEntry["source"];
/** `""` = tri par defaut du backend (date recente d'abord). */
export type OrderingFilter = "" | "created_at" | "-amount" | "amount";

export const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: "Tous types", value: "all" },
  { label: "Depenses", value: "expense" },
  { label: "Remboursements", value: "refund" },
];

export const SOURCE_OPTIONS: { label: string; value: SourceFilter }[] = [
  { label: "Toutes origines", value: "all" },
  { label: "Manuel", value: "manual" },
  { label: "Main d'oeuvre", value: "labor" },
];

export const ORDERING_OPTIONS: { label: string; value: OrderingFilter }[] = [
  { label: "Date recente", value: "" },
  { label: "Date ancienne", value: "created_at" },
  { label: "Montant decroissant", value: "-amount" },
  { label: "Montant croissant", value: "amount" },
];

export function getOptionLabel<T extends string>(
  options: { label: string; value: T }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? "";
}

/** Periode couverte par le graphique : celle des filtres si elle est posee, l'annee
 * en cours sinon — meme regle que le web. */
export function getChartRange(dateFrom: string | undefined, dateTo: string | undefined) {
  const currentYear = new Date().getFullYear();
  return {
    startDate: dateFrom || `${currentYear}-01-01`,
    endDate: dateTo || `${currentYear}-12-31`,
  };
}
