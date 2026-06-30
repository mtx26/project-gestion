"use client";

import type { AuthTokens, LoginPayload, User } from "@project-gestion/types";
import { create } from "zustand";
import { api, webTokenStore } from "@/lib/api";

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
  setUser: (user: User) => void;
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
    const refresh = await webTokenStore.getRefreshToken();
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
    const access = await webTokenStore.getAccessToken();
    const refresh = await webTokenStore.getRefreshToken();
    if (!access && !refresh) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const user = await api.auth.me();
      set({
        user,
        accessToken: await webTokenStore.getAccessToken(),
        refreshToken: await webTokenStore.getRefreshToken(),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await get().clearSession();
    }
  },
  setTokens: async (tokens) => {
    await webTokenStore.setTokens(tokens);
    set({
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      isAuthenticated: true,
    });
  },
  setUser: (user) => set({ user }),
  clearSession: async () => {
    await webTokenStore.clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

