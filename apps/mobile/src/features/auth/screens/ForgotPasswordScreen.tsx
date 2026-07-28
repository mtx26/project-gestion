import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  useServerFieldErrors(form, rawError, ["email"]);

  async function onSubmit(values: ResetPasswordFormValues) {
    setRawError(null);
    try {
      await api.auth.resetPassword(values.email);
      setMessage("Si un compte existe, un email de reinitialisation a ete envoye.");
    } catch (caught) {
      setRawError(caught);
    }
  }

  return (
    <Screen title="Mot de passe oublie" subtitle="Reinitialise ton mot de passe par email.">
      <InlineMessage>{message}</InlineMessage>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Envoyer le lien
      </Button>
      <Button variant="ghost" onPress={() => router.push("/")}>
        Retour connexion
      </Button>
    </Screen>
  );
}
