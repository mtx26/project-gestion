import { createApiClient } from "@project-gestion/api";
import { API_BASE_URL } from "@project-gestion/config";
import { getSessionToken } from "./allauth-client";
import { useAuthStore } from "../stores/auth-store";

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getSessionToken,
  onSessionInvalid: () => {
    // Import circulaire assume (auth-store importe `api`) : sans danger car
    // le store n'est lu qu'ici, a l'execution du callback, jamais au chargement
    // du module.
    // `Stack.Protected guard={isAuthenticated}` (app/_layout.tsx) reagit a ce
    // changement d'etat et bascule automatiquement vers le groupe (auth) —
    // pas de navigation manuelle necessaire ici.
    useAuthStore.getState().clearSession();
  },
});
