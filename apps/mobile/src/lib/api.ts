import { createApiClient, type TokenStore } from "@project-gestion/api";
import { API_BASE_URL, tokenStorageKeys } from "@project-gestion/config";
import * as SecureStore from "expo-secure-store";

let memoryAccessToken: string | null = null;

export const mobileTokenStore: TokenStore = {
  getAccessToken: () => memoryAccessToken,
  getRefreshToken: () => SecureStore.getItemAsync(tokenStorageKeys.refresh),
  setTokens: async ({ access, refresh }) => {
    memoryAccessToken = access;
    await SecureStore.setItemAsync(tokenStorageKeys.refresh, refresh);
  },
  clearTokens: async () => {
    memoryAccessToken = null;
    await SecureStore.deleteItemAsync(tokenStorageKeys.refresh);
  },
};

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  tokenStore: mobileTokenStore,
});
