import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@project-gestion/validation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Field, Message, Screen } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", first_name: "", last_name: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    try {
      await api.auth.register(values);
      navigation.replace("VerificationSent", { email: values.email });
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Creer un compte" subtitle="Verifie ton email avant la premiere connexion.">
      <View className="gap-4">
        {(["first_name", "last_name", "email"] as const).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <Field
                label={name === "first_name" ? "Prenom" : name === "last_name" ? "Nom" : "Email"}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                autoCapitalize={name === "email" ? "none" : "words"}
              />
            )}
          />
        ))}
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              label="Mot de passe"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={fieldState.error?.message}
            />
          )}
        />
        <Message danger>{error}</Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
          Creer le compte
        </Button>
        <Button variant="ghost" onPress={() => navigation.navigate("Login")}>
          Retour connexion
        </Button>
      </View>
    </Screen>
  );
}

