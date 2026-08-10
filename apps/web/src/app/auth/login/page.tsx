"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginFieldMap, loginSchema, type LoginFormValues } from "@project-gestion/validation";
import { needsProfileCompletion } from "@project-gestion/types";
import { MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { FormError } from "@/components/forms/form-error";
import { PasswordInput } from "@/components/forms/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isEmailVerificationPending } from "@/lib/allauth-client";
import { getErrorMessage } from "@/lib/errors";
import { getSafeNextPath, withNextParam } from "@/lib/next-path";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { useAuthStore } from "@/stores/auth-store";

function LoginContent() {
  const router = useRouter();
  // Page demandee avant d'etre redirige ici (cf. ProtectedRoute) — ex. un lien
  // d'invitation. On y revient une fois connecte.
  const nextPath = getSafeNextPath(useSearchParams().get("next"));
  const login = useAuthStore((state) => state.login);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useServerFieldErrors(form, rawError, loginFieldMap);

  async function onSubmit(values: LoginFormValues) {
    setRawError(null);
    setUnverifiedEmail(null);
    try {
      const user = await login(values);
      router.replace(
        needsProfileCompletion(user)
          ? withNextParam("/account/setup", nextPath)
          : (nextPath ?? "/dashboard"),
      );
    } catch (error) {
      if (isEmailVerificationPending(error)) {
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
          <GoogleSignInButton nextPath={nextPath} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
