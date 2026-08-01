import type { LoginPayload, User } from "@project-gestion/types";
import { create } from "zustand";
import { api, mobileSessionTokenStore } from "../lib/api";

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (payload) => {
    // Le session token renvoye dans `meta` est stocke par le client API.
    await api.auth.login(payload);
    const user = await api.auth.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },
  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      await get().clearSession();
    }
  },
  restoreSession: async () => {
    set({ isLoading: true });
    const sessionToken = await mobileSessionTokenStore.getSessionToken();
    if (!sessionToken) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    const session = await api.auth.session();
    if (!session.meta?.is_authenticated) {
      await get().clearSession();
      return;
    }

    try {
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await get().clearSession();
    }
  },
  clearSession: async () => {
    await mobileSessionTokenStore.setSessionToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
