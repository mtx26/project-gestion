import { createClient } from "@supabase/supabase-js";

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  storage?: StorageAdapter;
  persistSession?: boolean;
  autoRefreshToken?: boolean;
  detectSessionInUrl?: boolean;
}

export function createSupabaseAuthClient(config: SupabaseClientConfig) {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      persistSession: config.persistSession ?? true,
      autoRefreshToken: config.autoRefreshToken ?? true,
      detectSessionInUrl: config.detectSessionInUrl ?? true,
    },
  });
}
