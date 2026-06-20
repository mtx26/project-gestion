"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@project-gestion/validation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/form-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await api.auth.resetPassword(values.email);
      setMessage("Si un compte existe, un email de reinitialisation a ete envoye.");
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  }

  return (
    <AuthShell title="Mot de passe oublie" description="Reinitialise ton mot de passe par email.">
      <Card>
        <CardContent className="space-y-4 pt-6">
          {message ? (
            <Alert>
              <AlertTitle>Email envoye</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <FormError message={serverError} />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Envoyer le lien
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

