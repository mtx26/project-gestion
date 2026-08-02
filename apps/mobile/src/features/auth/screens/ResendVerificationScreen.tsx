import { zodResolver } from "@hookform/resolvers/zod";
import {
  resendVerificationFieldMap,
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
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

export function ResendVerificationScreen() {
  const router = useRouter();
  const { email, registered } = useLocalSearchParams<{ email?: string; registered?: string }>();
  const [message, setMessage] = useState<string | null>(
    registered === "true" ? "Verifie ton email." : null,
  );
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: email ?? "" },
  });

  useServerFieldErrors(form, rawError, resendVerificationFieldMap);

  async function onSubmit(values: ResendVerificationFormValues) {
    setRawError(null);
    try {
      await api.auth.resendVerification(values.email);
      setMessage("Si un compte existe et n'est pas verifie, un email a ete envoye.");
    } catch (caught) {
      setRawError(caught);
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
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Renvoyer l'email
      </Button>
      <Button variant="ghost" onPress={() => router.push("/")}>
        Retour connexion
      </Button>
    </Screen>
  );
}
