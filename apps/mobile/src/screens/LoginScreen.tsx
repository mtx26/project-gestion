import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@project-gestion/validation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Button, Field, Message, Screen } from "../components/ui";
import { ApiError } from "@project-gestion/api";
import { getErrorMessage } from "../lib/errors";
import { useAuthStore } from "../stores/auth-store";
import type { AuthStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setUnverifiedEmail(null);
    try {
      await login(values);
    } catch (caught) {
      // 401 = etape restante (email non verifie) ; allauth vient de renvoyer un lien.
      if (caught instanceof ApiError && caught.status === 401) {
        setUnverifiedEmail(values.identifier);
        return;
      }
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Connexion" subtitle="Connecte-toi pour acceder a ton dashboard.">
      <View className="gap-4">
        <Controller
          control={form.control}
          name="identifier"
          render={({ field, fieldState }) => (
            <Field
              label="Email ou nom d'utilisateur"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
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
        <Message danger>
          {unverifiedEmail
            ? `Email non verifie. Un nouveau lien vient d'etre envoye a ${unverifiedEmail}.`
            : null}
        </Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
          Se connecter
        </Button>
        <Button variant="ghost" onPress={() => navigation.navigate("ForgotPassword")}>
          Mot de passe oublie
        </Button>
        <Button variant="ghost" onPress={() => navigation.navigate("Register")}>
          Creer un compte
        </Button>
      </View>
    </Screen>
  );
}

