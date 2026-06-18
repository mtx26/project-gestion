import { createApiClient, type TokenStore } from "@project-gestion/api";
import { API_BASE_URL, tokenStorageKeys } from "@project-gestion/config";

let memoryAccessToken: string | null = null;

const isBrowser = () => typeof window !== "undefined";

export const webTokenStore: TokenStore = {
  getAccessToken: () => {
    if (memoryAccessToken) {
      return memoryAccessToken;
    }
    return isBrowser() ? window.localStorage.getItem(tokenStorageKeys.access) : null;
  },
  getRefreshToken: () =>
    isBrowser() ? window.localStorage.getItem(tokenStorageKeys.refresh) : null,
  setTokens: ({ access, refresh }) => {
    memoryAccessToken = access;
    if (isBrowser()) {
      window.localStorage.setItem(tokenStorageKeys.access, access);
      window.localStorage.setItem(tokenStorageKeys.refresh, refresh);
    }
  },
  clearTokens: () => {
    memoryAccessToken = null;
    if (isBrowser()) {
      window.localStorage.removeItem(tokenStorageKeys.access);
      window.localStorage.removeItem(tokenStorageKeys.refresh);
    }
  },
};

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  tokenStore: webTokenStore,
  onSessionInvalid: () => {
    if (isBrowser() && !window.location.pathname.startsWith("/auth")) {
      window.location.assign("/auth/login");
    }
  },
});

