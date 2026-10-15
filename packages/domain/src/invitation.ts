import { MOBILE_APP_SCHEME } from "@project-gestion/config";

/** Lien qui ouvre l'invitation dans l'application mobile.
 *
 * Un schema custom, et pas un lien universel `https` : ces derniers demandent des
 * fichiers d'association heberges et verifies par Apple et Google, que le
 * deploiement actuel ne fournit pas. C'est donc la page web d'acceptation qui
 * tente ce lien quand elle s'ouvre sur un telephone — l'email, lui, ne contient
 * que l'URL web, qui fonctionne partout. */
export function buildAppInvitationUrl(token: string): string {
  return `${MOBILE_APP_SCHEME}://invitations/accept?token=${encodeURIComponent(token)}`;
}
