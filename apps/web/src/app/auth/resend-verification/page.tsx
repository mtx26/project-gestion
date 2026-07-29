"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  resendVerificationFieldMap,
  resendVerificationSchema,
  type ResendVerificationFormValues,
} from "@project-gestion/validation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/forms/form-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";

const successMessage =
  "Si un compte existe et n'est pas verifie, un email a ete envoye.";

function ResendVerificationContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const registered = searchParams.get("registered") === "1";
  const [message, setMessage] = useState<string | null>(registered ? "Verifie ton email." : null);
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: initialEmail },
  });
  useServerFieldErrors(form, rawError, resendVerificationFieldMap);

  async function onSubmit(values: ResendVerificationFormValues) {
    setRawError(null);
    try {
      await api.auth.resendVerification(values.email);
      setMessage(successMessage);
    } catch (error) {
      setRawError(error);
    }
  }

  return (
    <AuthShell
      title="Verification email"
      description="Demande un nouvel email de verification si ton lien a expire."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          {message ? (
            <Alert>
              <AlertTitle>Information</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <FormError message={getErrorMessage(rawError)} />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Renvoyer l&apos;email
            </Button>
          </form>
          <Button asChild variant="link" className="w-full">
            <Link href="/auth/login">Retour a la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function ResendVerificationPage() {
  return (
    <Suspense>
      <ResendVerificationContent />
    </Suspense>
  );
}
