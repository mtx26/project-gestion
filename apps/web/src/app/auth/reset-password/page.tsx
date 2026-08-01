"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordConfirmSchema,
  type ResetPasswordConfirmFormValues,
} from "@project-gestion/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthShell } from "@/components/auth-shell";
import { FormError } from "@/components/forms/form-error";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<ResetPasswordConfirmFormValues>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      key: params.get("key") ?? "",
      password: "",
    },
  });
  useServerFieldErrors(form, rawError, ["key", "password"]);

  async function onSubmit(values: ResetPasswordConfirmFormValues) {
    setRawError(null);
    try {
      await api.auth.resetPasswordConfirm(values);
      router.replace("/auth/login?password_reset=1");
    } catch (error) {
      setRawError(error);
    }
  }

  return (
    <AuthShell title="Nouveau mot de passe" description="Definis un nouveau mot de passe.">
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <input type="hidden" {...form.register("key")} />
            <Field>
              <FieldLabel htmlFor="password">Nouveau mot de passe</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>
            <FormError
              message={form.formState.errors.key?.message ?? getErrorMessage(rawError)}
            />
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Mettre a jour
            </Button>
          </form>
          <Button asChild variant="link" className="mt-4 w-full">
            <Link href="/auth/login">Retour a la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
