/** Formatages dependants de la locale (fr-BE) — cote mobile, les memes rendus sont
 * produits a la main faute de donnees ICU garanties dans Hermes. Les formatages qui,
 * eux, ne dependent pas de la locale (duree, taille de fichier) vivent dans
 * `@project-gestion/domain` et sont partages tels quels.
 */
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium" }).format(new Date(value));
}

export function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}
