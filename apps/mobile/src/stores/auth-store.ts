import type { AuthTokens, LoginPayload, User } from "@project-gestion/types";
import { create } from "zustand";
import { api, mobileTokenStore } from "../lib/api";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (payload) => {
    const result = await api.auth.login(payload);
    await get().setTokens({ access: result.access, refresh: result.refresh });
    const user = await api.auth.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },
  logout: async () => {
    const refresh = await mobileTokenStore.getRefreshToken();
    try {
      if (refresh) {
        await api.auth.logout(refresh);
      }
    } finally {
      await get().clearSession();
    }
  },
  restoreSession: async () => {
    set({ isLoading: true });
    const refresh = await mobileTokenStore.getRefreshToken();
    if (!refresh) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const token = await api.auth.refresh(refresh);
      await get().setTokens({ access: token.access, refresh });
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await get().clearSession();
    }
  },
  setTokens: async (tokens) => {
    await mobileTokenStore.setTokens(tokens);
    set({
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      isAuthenticated: true,
    });
  },
  clearSession: async () => {
    await mobileTokenStore.clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
