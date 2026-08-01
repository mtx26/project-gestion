import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordConfirmSchema,
  type ResetPasswordConfirmFormValues,
} from "@project-gestion/validation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Field, Message, Screen } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordConfirmFormValues>({
    resolver: zodResolver(resetPasswordConfirmSchema),
    defaultValues: {
      key: route.params?.key ?? "",
      password: "",
    },
  });

  async function onSubmit(values: ResetPasswordConfirmFormValues) {
    setError(null);
    try {
      await api.auth.resetPasswordConfirm(values);
      navigation.replace("Login");
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Nouveau mot de passe" subtitle="Definis un nouveau mot de passe.">
      <View className="gap-4">
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              label="Nouveau mot de passe"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={fieldState.error?.message}
            />
          )}
        />
        <Message danger>
          {form.formState.errors.key?.message ?? error}
        </Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
          Mettre a jour
        </Button>
      </View>
    </Screen>
  );
}

