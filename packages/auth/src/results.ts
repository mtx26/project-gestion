import type {
  AuthError,
  AuthResponse,
  AuthTokenResponsePassword,
} from "@supabase/supabase-js";
import type { AuthActionResult } from "./types";

type SupabaseAuthResult =
  | AuthResponse
  | AuthTokenResponsePassword
  | { error: AuthError | null };

export function createAuthActionResult(
  result: SupabaseAuthResult,
  successMessage: string
): AuthActionResult {
  return {
    error: result.error,
    message: result.error?.message ?? successMessage,
  };
}

export function createMissingClientResult(): AuthActionResult {
  return {
    error: {
      name: "AuthError",
      message: "Missing Supabase client.",
    } as AuthError,
    message: "Missing Supabase client.",
  };
}
