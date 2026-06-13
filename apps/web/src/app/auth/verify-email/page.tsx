"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

function VerifyEmailContent() {
  const key = useSearchParams().get("key");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Verification en cours...");

  useEffect(() => {
    async function verify() {
      if (!key) {
        setStatus("error");
        setMessage("Cle de verification manquante.");
        return;
      }

      try {
        await api.auth.verifyEmail(key);
        setStatus("success");
        setMessage("Ton email est confirme. Tu peux maintenant te connecter.");
      } catch (error) {
        setStatus("error");
        setMessage(getErrorMessage(error));
      }
    }

    void verify();
  }, [key]);

  return (
    <AuthShell title="Verifier email" description="Confirmation de ton adresse email.">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert variant={status === "error" ? "destructive" : "default"}>
            {status === "success" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            <AlertTitle>{status === "success" ? "Email verifie" : "Verification"}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          {status === "success" ? (
            <Button asChild className="w-full">
              <Link href="/auth/login">Aller a la connexion</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
