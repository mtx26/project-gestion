import { needsProfileCompletion } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "./ui/Button";
import { isGoogleSignInConfigured, signInWithGoogle } from "../lib/google-signin";
import { useAuthStore } from "../stores/auth-store";

interface GoogleSignInButtonProps {
  /** Recoit l'erreur brute (comme les autres formulaires) pour que l'ecran la
   * traduise lui-meme via `getErrorMessage`. */
  onError: (error: unknown) => void;
}

export function GoogleSignInButton({ onError }: GoogleSignInButtonProps) {
  const router = useRouter();
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const [isPending, setIsPending] = useState(false);

  if (!isGoogleSignInConfigured) {
    return null;
  }

  async function onPress() {
    onError(null);
    setIsPending(true);
    try {
      const idToken = await signInWithGoogle();
      // `null` = l'utilisateur a ferme la feuille Google : on ne signale rien.
      if (!idToken) {
        return;
      }
      // Meme regle que la connexion par mot de passe : Google ne fournit pas
      // toujours prenom/nom, donc on verifie l'utilisateur reellement recupere.
      const user = await loginWithGoogle(idToken);
      if (needsProfileCompletion(user)) {
        router.replace("/account-setup");
      }
    } catch (caught) {
      onError(caught);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button variant="secondary" onPress={onPress} disabled={isPending}>
      {isPending ? "Connexion..." : "Continuer avec Google"}
    </Button>
  );
}
