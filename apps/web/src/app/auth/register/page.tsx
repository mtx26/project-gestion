"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormValues } from "@project-gestion/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { FormError } from "@/components/forms/form-error";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as allauthClient from "@/lib/allauth-client";
import { getErrorMessage } from "@/lib/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setRawError(null);
    try {
      await allauthClient.signup(values);
      router.push(`/auth/resend-verification?email=${encodeURIComponent(values.email)}&registered=1`);
    } catch (error) {
      setRawError(error);
    }
  }

  return (
    <AuthShell
      title="Creer un compte"
      description="Inscris-toi avec ton email. Le compte devra etre verifie avant la connexion."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <GoogleSignInButton />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>
            <FormError message={getErrorMessage(rawError)} />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Creer le compte
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Deja inscrit ?{" "}
            <Link className="font-medium text-teal-700" href="/auth/login">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
