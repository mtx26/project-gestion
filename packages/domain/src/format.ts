/** Formatages qui ne dependent pas de la locale du systeme : les memes chaines sont
 * attendues sur web et sur mobile, et aucun `Intl` n'est implique — ce qui compte pour
 * mobile, ou Hermes n'embarque pas forcement les donnees ICU. Les formatages qui, eux,
 * dependent d'une locale (montants, dates) restent propres a chaque app. */

/** "1h 30m" / "2h" — duree de travail, jamais negative. */
export function formatDuration(totalMinutes: number): string {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** "820 Ko" / "1.4 Mo" — taille de fichier. Chaine vide quand la taille est inconnue,
 * pour que l'appelant puisse l'afficher sans condition. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** "YYYY-MM-DD" d'une date, dans le fuseau local — la forme attendue par l'API pour
 * un champ date sans heure (date d'une ecriture, bornes de periode). Ecrit a la main
 * pour ne pas passer par `toISOString()`, qui bascule en UTC et peut decaler d'un jour. */
export function toIsoDateString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
