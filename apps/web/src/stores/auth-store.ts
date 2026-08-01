"use client";

import type { LoginPayload, User } from "@project-gestion/types";
import { create } from "zustand";
import { api } from "@/lib/api";
import { ensureCsrfToken } from "@/lib/csrf";

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: User) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (payload) => {
    // Le POST de connexion est protege par CSRF : le cookie doit exister avant.
    await ensureCsrfToken();
    await api.auth.login(payload);
    const user = await api.auth.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },
  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  restoreSession: async () => {
    set({ isLoading: true });
    // Repose uniquement sur le cookie de session : rien n'est lu depuis le storage.
    const session = await api.auth.session();
    if (!session.meta?.is_authenticated) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  setUser: (user) => set({ user }),
  clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
