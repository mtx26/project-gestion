import { zodResolver } from "@hookform/resolvers/zod";
import { personNameSchema } from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { TextInput as RNTextInput } from "react-native";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";

/** allauth Headless `auth/signup` ne collecte que email + mot de passe —
 * prenom/nom sont completes ici, apres la 1ere connexion (voir
 * LoginScreen : redirige ici tant que `needsProfileCompletion` est vrai). */
const accountSetupSchema = z.object({
  first_name: personNameSchema("Le prenom est requis"),
  last_name: personNameSchema("Le nom est requis"),
});
type AccountSetupFormValues = z.infer<typeof accountSetupSchema>;

export function AccountSetupScreen() {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const lastNameRef = useRef<RNTextInput>(null);
  const form = useForm<AccountSetupFormValues>({
    resolver: zodResolver(accountSetupSchema),
    defaultValues: { first_name: "", last_name: "" },
  });

  async function onSubmit(values: AccountSetupFormValues) {
    setRawError(null);
    try {
      const user = await api.auth.updateMe(values);
      useAuthStore.setState({ user });
      router.replace("/");
    } catch (caught) {
      setRawError(caught);
    }
  }

  return (
    <Screen title="Complete ton profil" subtitle="Ajoute ton prenom et ton nom.">
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
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Terminer
      </Button>
    </Screen>
  );
}
