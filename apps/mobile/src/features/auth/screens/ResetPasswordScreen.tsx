import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { api, mobileTokenStore } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";

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

  useServerFieldErrors(form, rawError, ["uid", "token", "new_password"]);

  async function onSubmit(values: ResetPasswordConfirmFormValues) {
    setRawError(null);
    try {
      await api.auth.resetPasswordConfirm(values);
      await mobileTokenStore.clearTokens();
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
