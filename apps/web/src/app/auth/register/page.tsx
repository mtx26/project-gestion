"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@project-gestion/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/forms/form-error";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GoogleLoginButton } from "@/components/google-login-button";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";

export default function RegisterPage() {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", first_name: "", last_name: "" },
  });

  useServerFieldErrors(form, rawError, ["email", "password", "first_name", "last_name"]);

  async function onSubmit(values: RegisterFormValues) {
    setRawError(null);
    try {
      await api.auth.register(values);
      router.push(`/auth/verification-sent?email=${encodeURIComponent(values.email)}`);
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
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="first_name">Prenom</FieldLabel>
                <Input id="first_name" {...form.register("first_name")} />
                <FieldError errors={[form.formState.errors.first_name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="last_name">Nom</FieldLabel>
                <Input id="last_name" {...form.register("last_name")} />
                <FieldError errors={[form.formState.errors.last_name]} />
              </Field>
            </div>
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
          <GoogleLoginButton label="S'inscrire avec Google" />
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
