import { zodResolver } from "@hookform/resolvers/zod";
import {
  resendVerificationSchema,
  type ResendVerificationFormValues,
} from "@project-gestion/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";

export function ResendVerificationScreen() {
  const router = useRouter();
  const { email, registered } = useLocalSearchParams<{ email?: string; registered?: string }>();
  const [message, setMessage] = useState<string | null>(
    registered === "true" ? "Verifie ton email." : null,
  );
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: email ?? "" },
  });

  async function onSubmit(values: ResendVerificationFormValues) {
    setError(null);
    try {
      await api.auth.resendVerification(values.email);
      setMessage("Si un compte existe et n'est pas verifie, un email a ete envoye.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Verification email" subtitle="Demande un nouvel email de verification.">
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
      <InlineMessage variant="danger">{error}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Renvoyer l'email
      </Button>
      <Button variant="ghost" onPress={() => router.push("/")}>
        Retour connexion
      </Button>
    </Screen>
  );
}
