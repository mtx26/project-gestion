"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@project-gestion/validation";
import { MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/forms/form-error";
import { PasswordInput } from "@/components/forms/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage, isEmailVerificationRequired } from "@/lib/errors";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useServerFieldErrors(form, rawError, [
    "identifier",
    { name: "identifier", serverField: "username" },
    "password",
  ]);

  async function onSubmit(values: LoginFormValues) {
    setRawError(null);
    setUnverifiedEmail(null);
    try {
      await login(values);
      const setupAfterLogin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1";
      router.replace(setupAfterLogin ? "/account/setup" : "/dashboard");
    } catch (error) {
      if (isEmailVerificationRequired(error)) {
        setUnverifiedEmail(values.identifier);
        return;
      }
      setRawError(error);
    }
  }

  return (
    <AuthShell title="Connexion" description="Connecte-toi pour acceder a ton dashboard.">
      <Card>
        <CardContent className="space-y-4 pt-6">
          {unverifiedEmail ? (
            <Alert>
              <MailWarning className="size-4" />
              <AlertTitle>Email non verifie</AlertTitle>
              <AlertDescription className="space-y-3">
                <span>Verifie ton email avant de te connecter.</span>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/auth/resend-verification?email=${encodeURIComponent(unverifiedEmail)}`}>
                    Renvoyer l&apos;email
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field>
              <FieldLabel htmlFor="identifier">Email ou nom d&apos;utilisateur</FieldLabel>
              <Input id="identifier" autoComplete="username" {...form.register("identifier")} />
              <FieldError errors={[form.formState.errors.identifier]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>
            <FormError message={getErrorMessage(rawError)} />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Se connecter
            </Button>
          </form>
          <div className="flex items-center justify-between text-sm">
            <Link className="text-muted-foreground hover:text-foreground" href="/auth/forgot-password">
              Mot de passe oublie
            </Link>
            <Link className="font-medium text-teal-700" href="/auth/register">
              Creer un compte
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
