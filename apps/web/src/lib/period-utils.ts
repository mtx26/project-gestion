export type PeriodPreset = "this-month" | "last-month" | "this-week" | "last-30-days" | "this-year" | "all";

export function getPeriodLabel(preset: PeriodPreset): string {
  if (preset === "this-week") return "Cette semaine";
  if (preset === "this-month") return "Ce mois";
  if (preset === "last-month") return "Mois dernier";
  if (preset === "last-30-days") return "30 derniers jours";
  if (preset === "this-year") return "Cette année";
  return "Toutes dates";
}

/** Détecte si une paire de dates correspond à un preset connu. Retourne "custom" sinon. */
export function detectPreset(from?: string, to?: string): PeriodPreset | "custom" {
  if (!from && !to) return "all";
  const presets: PeriodPreset[] = ["this-week", "this-month", "last-month", "last-30-days", "this-year"];
  for (const p of presets) {
    const r = getPeriodRange(p);
    if (r.startDate === from && r.endDate === to) return p;
  }
  return "custom";
}

export function toIsoDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getPeriodRange(period: PeriodPreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (period === "all") return {};
  if (period === "this-week") {
    const dayOffset = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    return { startDate: toIsoDateString(start), endDate: toIsoDateString(now) };
  }
  if (period === "last-30-days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { startDate: toIsoDateString(start), endDate: toIsoDateString(now) };
  }
  if (period === "this-year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: toIsoDateString(start), endDate: toIsoDateString(now) };
  }
  const monthOffset = period === "last-month" ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  return { startDate: toIsoDateString(start), endDate: toIsoDateString(end) };
}
