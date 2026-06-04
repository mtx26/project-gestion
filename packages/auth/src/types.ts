import type { AuthError, Session, User } from "@supabase/supabase-js";

export type AuthMode = "sign-in" | "sign-up";

export interface AuthActionResult {
  error: AuthError | null;
  message: string;
}

export interface AuthController {
  session: Session | null;
  user: User | null;
  loading: boolean;
  message: string;
  clearMessage(): void;
  signInWithPassword(email: string, password: string): Promise<AuthActionResult>;
  signUpWithPassword(email: string, password: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
}
