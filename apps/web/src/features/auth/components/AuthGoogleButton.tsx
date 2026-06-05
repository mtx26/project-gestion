"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { getNextFromSearch, withAuthCallbackNext } from "../routes";

interface AuthGoogleButtonProps {
  onError(message: string): void;
}

export function AuthGoogleButton({ onError }: AuthGoogleButtonProps) {
  const supabase = getSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);

  async function handleGoogleAuth() {
    setIsLoading(true);
    onError("");

    try {
      const nextPath = getNextFromSearch(
        new URLSearchParams(window.location.search)
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            process.env.NEXT_PUBLIC_APP_URL + withAuthCallbackNext(nextPath),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setIsLoading(false);
        onError(error.message);
      }
    } catch (error) {
      setIsLoading(false);
      onError(
        error instanceof Error ? error.message : "Unable to sign in with Google."
      );
    }
  }

  return (
    <button type="button" onClick={handleGoogleAuth} disabled={isLoading}>
      {isLoading ? "Redirecting..." : "Continue with Google"}
    </button>
  );
}
