// Manual formatting (no Intl.NumberFormat) so this doesn't depend on Hermes
// shipping with ICU data enabled — same reasoning as date-format.ts.
export function formatMoney(value: number | string): string {
  const amount = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const [intPart, decPart] = Math.abs(safe).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${safe < 0 ? "-" : ""}${grouped},${decPart} €`;
}
