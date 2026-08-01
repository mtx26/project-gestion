"use client";

import { XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { translateError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

/** Page d'atterrissage du flux OAuth : django-allauth y renvoie le navigateur une
 * fois le provider consulte. La session est deja posee en cookie ; il ne reste qu'a
 * la charger, ou a afficher l'erreur transmise en parametre. */
export function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [failed, setFailed] = useState(Boolean(error));

  useEffect(() => {
    if (error) return;

    async function complete() {
      await restoreSession();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace("/dashboard");
        return;
      }
      setFailed(true);
    }

    void complete();
  }, [error, restoreSession, router]);

  if (!failed) {
    return (
      <AuthShell title="Connexion" description="Finalisation de la connexion...">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Connexion" description="La connexion n'a pas abouti.">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Connexion impossible</AlertTitle>
            <AlertDescription>
              {error ? translateError(error) : "La session n'a pas pu etre ouverte."}
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/auth/login">Retour a la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
