"use client";

import { needsProfileCompletion } from "@project-gestion/types";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getSafeNextPath, withNextParam } from "@/lib/next-path";
import { useAuthStore } from "@/stores/auth-store";

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Connexion annulee.",
  permission_denied: "Acces refuse par Google.",
};

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    if (error) {
      return;
    }

    async function finish() {
      const user = await restoreSession();
      router.replace(
        user && needsProfileCompletion(user)
          ? withNextParam("/account/setup", nextPath)
          : (nextPath ?? "/dashboard"),
      );
    }

    void finish();
  }, [error, nextPath, restoreSession, router]);

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="size-4" />
        <AlertTitle>Connexion Google impossible</AlertTitle>
        <AlertDescription className="space-y-3">
          <span>{ERROR_MESSAGES[error ?? ""] ?? "Une erreur est survenue."}</span>
          <Button asChild variant="secondary" size="sm">
            <Link href="/auth/login">Retour a la connexion</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <CheckCircle2 className="size-4" />
      <AlertTitle className="flex items-center gap-2">
        <Spinner className="size-4" />
        Connexion en cours...
      </AlertTitle>
      <AlertDescription>On te redirige vers ton dashboard.</AlertDescription>
    </Alert>
  );
}

export default function GoogleCallbackPage() {
  return (
    <AuthShell title="Connexion Google" description="Finalisation de la connexion.">
      <Card>
        <CardContent className="pt-6">
          <Suspense>
            <GoogleCallbackContent />
          </Suspense>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
