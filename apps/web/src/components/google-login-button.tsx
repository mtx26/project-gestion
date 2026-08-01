"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ensureCsrfToken } from "@/lib/csrf";

/** Bouton de connexion Google.
 *
 * `POST /_allauth/browser/v1/auth/provider/redirect` est le point d'entree officiel
 * du flux OAuth cote navigateur : il repond par une redirection vers Google, ce que
 * `fetch` ne peut pas suivre. On soumet donc un vrai formulaire, avec le jeton CSRF
 * attendu par Django. Aucune partie du flux OAuth n'est reimplementee ici.
 */
export function GoogleLoginButton({ label = "Continuer avec Google" }: { label?: string }) {
  const [form, setForm] = useState<{ csrfToken: string; callbackUrl: string } | null>(null);

  useEffect(() => {
    void ensureCsrfToken().then((csrfToken) => {
      if (!csrfToken) return;
      setForm({ csrfToken, callbackUrl: `${window.location.origin}/auth/callback` });
    });
  }, []);

  return (
    <form action={api.auth.providerRedirectUrl()} method="post">
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="callback_url" value={form?.callbackUrl ?? ""} />
      <input type="hidden" name="process" value="login" />
      <input type="hidden" name="csrfmiddlewaretoken" value={form?.csrfToken ?? ""} />
      <Button className="w-full" type="submit" variant="outline" disabled={!form}>
        {label}
      </Button>
    </form>
  );
}
