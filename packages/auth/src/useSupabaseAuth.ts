import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthRedirect, type AuthRedirects } from "./redirects";
import { createAuthActionResult, createMissingClientResult } from "./results";
import { runAuthAction } from "./runAuthAction";
import type { AuthController } from "./types";

export interface UseSupabaseAuthOptions {
  redirects?: AuthRedirects;
}

export function useSupabaseAuth(
  supabase: SupabaseClient | null,
  options: UseSupabaseAuthOptions = {}
): AuthController {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const redirects = options.redirects;

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }

        setSession(data.session);
        setMessage(error?.message ?? "");
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }

        setSession(null);
        setMessage(error instanceof Error ? error.message : "Unable to load session.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const clearMessage = useCallback(() => {
    setMessage("");
  }, []);

  const signInWithPassword = useCallback(
    (email: string, password: string) =>
      runAuthAction(setLoading, setMessage, async () => {
        if (!supabase) {
          return createMissingClientResult();
        }

        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        return createAuthActionResult(result, "Signed in.");
      }),
    [supabase]
  );

  const signUpWithPassword = useCallback(
    (email: string, password: string) =>
      runAuthAction(setLoading, setMessage, async () => {
        if (!supabase) {
          return createMissingClientResult();
        }

        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: resolveAuthRedirect(redirects, "sign-up"),
          },
        });

        return createAuthActionResult(result, "Check your email to confirm your account.");
      }),
    [redirects, supabase]
  );

  const signOut = useCallback(
    () =>
      runAuthAction(setLoading, setMessage, async () => {
        if (!supabase) {
          return createMissingClientResult();
        }

        const result = await supabase.auth.signOut();

        return createAuthActionResult(result, "Signed out.");
      }),
    [supabase]
  );

  return useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      message,
      clearMessage,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [
      clearMessage,
      loading,
      message,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword,
    ]
  );
}
