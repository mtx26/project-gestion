/** URL du flux iCal d'un abonnement calendrier : c'est ce lien qu'on colle dans
 * Google Calendar, Outlook ou Apple Calendar. Construit ici plutot que dans chaque
 * app, pour que le chemin `.ics` ne soit ecrit qu'une fois. */
export function buildCalendarFeedUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/calendar/${token}.ics`;
}

/** Variante `webcal://` du meme flux : les systemes qui la reconnaissent (iOS en
 * tete) ouvrent directement l'application Calendrier sur la proposition
 * d'abonnement, au lieu de telecharger le fichier. */
export function toWebcalUrl(feedUrl: string): string {
  return feedUrl.replace(/^https?:\/\//, "webcal://");
}
