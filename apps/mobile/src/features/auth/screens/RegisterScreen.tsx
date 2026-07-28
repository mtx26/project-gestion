import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { TextInput as RNTextInput } from "react-native";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";

export function RegisterScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const lastNameRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", first_name: "", last_name: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    try {
      await api.auth.register(values);
      router.replace({
        pathname: "/resend-verification",
        params: { email: values.email, registered: "true" },
      });
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Creer un compte" subtitle="Verifie ton email avant la premiere connexion.">
      <Controller
        control={form.control}
        name="first_name"
        render={({ field, fieldState }) => (
          <FormField
            label="Prenom"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="words"
            textContentType="givenName"
            autoComplete="given-name"
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            blurOnSubmit={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="last_name"
        render={({ field, fieldState }) => (
          <FormField
            ref={lastNameRef}
            label="Nom"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="words"
            textContentType="familyName"
            autoComplete="family-name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            blurOnSubmit={false}
          />
        )}
      />
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            ref={emailRef}
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
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
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">{error}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Creer le compte
      </Button>
      <Button variant="ghost" onPress={() => router.push("/")}>
        Retour connexion
      </Button>
    </Screen>
  );
}
