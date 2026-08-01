"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function VerificationSentContent() {
  const email = useSearchParams().get("email");

  return (
    <AuthShell
      title="Verifie ton email"
      description="Ton compte est cree, il reste a confirmer ton adresse."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert>
            <MailCheck className="size-4" />
            <AlertTitle>Email envoye</AlertTitle>
            <AlertDescription>
              Un lien de verification a ete envoye{email ? ` a ${email}` : ""}. Si tu ne
              le retrouves pas, retente une connexion : un nouveau lien est envoye a
              chaque tentative tant que l&apos;adresse n&apos;est pas confirmee.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/auth/login">Aller a la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function VerificationSentPage() {
  return (
    <Suspense>
      <VerificationSentContent />
    </Suspense>
  );
}
