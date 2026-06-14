"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@project-gestion/validation";
import { MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/form-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage, getFieldError, isEmailVerificationRequired } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
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
      setServerError(getErrorMessage(error));
      for (const field of ["identifier", "password", "username"] as const) {
        const message = getFieldError(error, field);
        if (message && field !== "username") {
          form.setError(field, { message });
        }
      }
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
            <div className="space-y-2">
              <Label htmlFor="identifier">Email ou nom d&apos;utilisateur</Label>
              <Input id="identifier" autoComplete="username" {...form.register("identifier")} />
              <FormError message={form.formState.errors.identifier?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              <FormError message={form.formState.errors.password?.message} />
            </div>
            <FormError message={serverError} />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Se connecter
            </Button>
          </form>
          <div className="flex items-center justify-between text-sm">
            <Link className="text-slate-600 hover:text-teal-700" href="/auth/forgot-password">
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
