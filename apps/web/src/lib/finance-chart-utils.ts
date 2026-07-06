export const financeChartConfig = {
  expenses: { label: "Depenses", color: "var(--destructive)" },
  refunds: { label: "Remboursements", color: "oklch(0.6 0.15 150)" },
};

export function formatFinancePeriod(period: string): string {
  const [year, month] = period.split("-");
  if (year && month) {
    const names = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year.slice(2)}`;
  }
  return period;
}
