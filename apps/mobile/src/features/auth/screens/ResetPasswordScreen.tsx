import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordConfirmFieldMap,
  resetPasswordConfirmSchema,
  type ResetPasswordConfirmFormValues,
} from "@project-gestion/validation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import * as allauthClient from "../../../lib/allauth-client";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { useAuthStore } from "../../../stores/auth-store";

export function ResetPasswordScreen() {
  const router = useRouter();
  const { uid, token } = useLocalSearchParams<{ uid?: string; token?: string }>();
  const [rawError, setRawError] = useState<unknown>(null);
  const form = useForm<ResetPasswordConfirmFormValues>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      uid: uid ?? "",
      token: token ?? "",
      new_password: "",
    },
  });

  useServerFieldErrors(form, rawError, resetPasswordConfirmFieldMap);

  async function onSubmit(values: ResetPasswordConfirmFormValues) {
    setRawError(null);
    try {
      await api.auth.resetPasswordConfirm(values);
      // Purge une session eventuellement encore active/en cache (le lien de
      // reinitialisation est typiquement ouvert deconnecte, mais on force
      // quand meme un login propre avec le nouveau mot de passe).
      await allauthClient.logout();
      useAuthStore.getState().clearSession();
      router.replace("/");
    } catch (caught) {
      setRawError(caught);
    }
  }

  return (
    <Screen title="Nouveau mot de passe" subtitle="Definis un nouveau mot de passe.">
      <Controller
        control={form.control}
        name="new_password"
        render={({ field, fieldState }) => (
          <FormField
            label="Nouveau mot de passe"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">
        {form.formState.errors.uid?.message ??
          form.formState.errors.token?.message ??
          getErrorMessage(rawError)}
      </InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Mettre a jour
      </Button>
    </Screen>
  );
}
