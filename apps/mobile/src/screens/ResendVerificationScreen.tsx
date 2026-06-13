import { zodResolver } from "@hookform/resolvers/zod";
import {
  resendVerificationSchema,
  type ResendVerificationFormValues,
} from "@project-gestion/validation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Field, Message, Screen } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "ResendVerification">;

export function ResendVerificationScreen({ navigation, route }: Props) {
  const [message, setMessage] = useState<string | null>(
    route.params?.registered ? "Verifie ton email." : null,
  );
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: route.params?.email ?? "" },
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
      <View className="gap-4">
        <Message>{message}</Message>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Message danger>{error}</Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
          Renvoyer l'email
        </Button>
        <Button variant="ghost" onPress={() => navigation.navigate("Login")}>
          Retour connexion
        </Button>
      </View>
    </Screen>
  );
}

