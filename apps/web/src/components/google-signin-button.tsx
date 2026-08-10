"use client";

import { Button } from "@/components/ui/button";
import * as allauthClient from "@/lib/allauth-client";
import { GoogleIcon } from "@/components/icons/google-icon";
import { withNextParam } from "@/lib/next-path";

interface GoogleSignInButtonProps {
  /** Page a rejoindre apres connexion (transportee jusqu'a la page de callback). */
  nextPath?: string | null;
}

export function GoogleSignInButton({ nextPath }: GoogleSignInButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() =>
        allauthClient.redirectToGoogle(
          `${window.location.origin}${withNextParam("/auth/google/callback", nextPath)}`,
        )
      }
    >
      <GoogleIcon className="size-4" />
      Continuer avec Google
    </Button>
  );
}
