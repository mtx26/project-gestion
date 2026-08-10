import type { User } from "@project-gestion/types";
import { create } from "zustand";
import { api } from "../lib/api";
import * as allauthClient from "../lib/allauth-client";
import { googleWebClientId, signOutFromGoogle } from "../lib/google-signin";

type LoginCredentials = { identifier: string; password: string };

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async ({ identifier, password }) => {
    await allauthClient.login(
      identifier.includes("@") ? { email: identifier, password } : { username: identifier, password },
    );
    const user = await api.auth.me();
    set({ user, isAuthenticated: true, isLoading: false });
    return user;
  },
  loginWithGoogle: async (idToken) => {
    await allauthClient.loginWithGoogle(idToken, googleWebClientId);
    const user = await api.auth.me();
    set({ user, isAuthenticated: true, isLoading: false });
    return user;
  },
  logout: async () => {
    try {
      await allauthClient.logout();
      await signOutFromGoogle();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const session = await allauthClient.getSession();
      if (!session.meta?.is_authenticated) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
