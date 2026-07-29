import { zodResolver } from "@hookform/resolvers/zod";
import { isEmailVerificationRequired } from "@project-gestion/api";
import { loginFieldMap, loginSchema, type LoginFormValues } from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { TextInput as RNTextInput } from "react-native";
import { View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { useAuthStore } from "../../../stores/auth-store";

export function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [rawError, setRawError] = useState<unknown>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useServerFieldErrors(form, rawError, loginFieldMap);

  async function onSubmit(values: LoginFormValues) {
    setRawError(null);
    setUnverifiedEmail(null);
    try {
      await login(values);
    } catch (caught) {
      if (isEmailVerificationRequired(caught)) {
        setUnverifiedEmail(values.identifier);
        return;
      }
      setRawError(caught);
    }
  }

  return (
    <Screen title="Connexion" subtitle="Connecte-toi pour acceder a ton dashboard.">
      <Controller
        control={form.control}
        name="identifier"
        render={({ field, fieldState }) => (
          <FormField
            label="Email ou nom d'utilisateur"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            ref={passwordRef}
            label="Mot de passe"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <InlineMessage variant="danger">
        {unverifiedEmail ? "Email non verifie. Renvoyez l'email de verification." : null}
      </InlineMessage>
      {unverifiedEmail ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/resend-verification", params: { email: unverifiedEmail } })
          }
        >
          Renvoyer l'email
        </Button>
      ) : null}
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Se connecter
      </Button>
      <View className="gap-2">
        <Button variant="ghost" onPress={() => router.push("/forgot-password")}>
          Mot de passe oublie
        </Button>
        <Button variant="ghost" onPress={() => router.push("/register")}>
          Creer un compte
        </Button>
      </View>
    </Screen>
  );
}
