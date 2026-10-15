import { createApiClient } from "@project-gestion/api";
import { API_BASE_URL } from "@project-gestion/config";
import { getSessionToken } from "./allauth-client";

/** Ce que faire quand le serveur declare la session morte (401 sur un appel
 * authentifie). Enregistre par le store d'auth plutot qu'importe d'ici : sans ca,
 * `api` et `auth-store` s'importeraient mutuellement, et Metro previent qu'un
 * import circulaire peut livrer une valeur non initialisee. */
let sessionInvalidHandler: (() => void) | null = null;

export function setSessionInvalidHandler(handler: () => void) {
  sessionInvalidHandler = handler;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getSessionToken,
  onSessionInvalid: () => {
    // `Stack.Protected guard={isAuthenticated}` (app/_layout.tsx) reagit au
    // changement d'etat et bascule automatiquement vers le groupe (auth) —
    // pas de navigation manuelle necessaire ici.
    sessionInvalidHandler?.();
  },
});
