import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@project-gestion/validation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Field, Message, Screen } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setError(null);
    try {
      await api.auth.resetPassword(values.email);
      setMessage("Si un compte existe, un email de reinitialisation a ete envoye.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Mot de passe oublie" subtitle="Reinitialise ton mot de passe par email.">
      <View className="gap-4">
        <Message>{message}</Message>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field label="Email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )}
        />
        <Message danger>{error}</Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
          Envoyer le lien
        </Button>
        <Button variant="ghost" onPress={() => navigation.navigate("Login")}>
          Retour connexion
        </Button>
      </View>
    </Screen>
  );
}

