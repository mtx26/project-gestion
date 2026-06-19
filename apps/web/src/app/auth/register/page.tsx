"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@project-gestion/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/form-error";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getErrorMessage, getFieldError } from "@/lib/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", first_name: "", last_name: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      await api.auth.register(values);
      router.push(`/auth/resend-verification?email=${encodeURIComponent(values.email)}&registered=1`);
    } catch (error) {
      setServerError(getErrorMessage(error));
      for (const field of ["email", "password", "first_name", "last_name"] as const) {
        const message = getFieldError(error, field);
        if (message) {
          form.setError(field, { message });
        }
      }
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
              <div className="space-y-2">
                <Label htmlFor="first_name">Prenom</Label>
                <Input id="first_name" {...form.register("first_name")} />
                <FormError message={form.formState.errors.first_name?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input id="last_name" {...form.register("last_name")} />
                <FormError message={form.formState.errors.last_name?.message} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              <FormError message={form.formState.errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FormError message={form.formState.errors.password?.message} />
            </div>
            <FormError message={serverError} />
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
