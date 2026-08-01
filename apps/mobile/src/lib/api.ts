import { createApiClient, type SessionTokenStore } from "@project-gestion/api";
import { API_BASE_URL, sessionTokenStorageKey } from "@project-gestion/config";
import * as SecureStore from "expo-secure-store";

export const mobileSessionTokenStore: SessionTokenStore = {
  getSessionToken: () => SecureStore.getItemAsync(sessionTokenStorageKey),
  setSessionToken: async (token) => {
    if (token === null) {
      await SecureStore.deleteItemAsync(sessionTokenStorageKey);
      return;
    }
    await SecureStore.setItemAsync(sessionTokenStorageKey, token);
  },
};

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  // Client headless "app" : pas de cookie sur mobile, la session est portee par
  // l'en-tete `X-Session-Token` et conservee dans le keystore securise.
  client: "app",
  sessionTokenStore: mobileSessionTokenStore,
});
