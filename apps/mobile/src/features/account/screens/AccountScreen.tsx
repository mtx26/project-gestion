import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@project-gestion/types";
import {
  accountProfileSchema,
  changePasswordSchema,
  normalizeAmountInput,
  type AccountProfileFormValues,
  type ChangePasswordFormValues,
} from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { MemberAvatar } from "../../../components/ui/MemberAvatar";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { UploadMenu } from "../../../components/documents/UploadMenu";
import { theme } from "../../../theme";
import { DetailScreen } from "../../../components/layout/DetailScreen";
import { useAuthStore } from "../../../stores/auth-store";
import { useChangePassword, useUpdateAccount, useUploadProfilePicture } from "../hooks/use-account";

export function AccountScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <DetailScreen includeTopEdge>
      <View className="flex-row items-center justify-between gap-2 px-5 pt-4">
        <Text className="text-2xl font-semibold text-foreground">Mon compte</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="h-11 justify-center">
          <Text className="text-base font-semibold text-primary">Fermer</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileSection user={user} />
        <PasswordSection />
      </ScrollView>
    </DetailScreen>
  );
}

function getProfileValues(user: User | null): AccountProfileFormValues {
  return {
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    default_hourly_rate: user?.profile?.default_hourly_rate ?? "0",
  };
}

function ProfileSection({ user }: { user: User | null }) {
  const updateAccount = useUpdateAccount();
  const uploadPicture = useUploadProfilePicture();

  const [pictureError, setPictureError] = useState<string | null>(null);

  const form = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    values: getProfileValues(user),
  });

  useServerFieldErrors(form, updateAccount.error, ["username", "first_name", "last_name"]);

  const [firstName, lastName, username] = form.watch(["first_name", "last_name", "username"]);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || username || "Compte";

  // Le recadrage passe par l'outil du systeme (`allowsEditing`), plutot que par un
  // editeur maison comme sur le web : c'est celui que l'utilisateur connait deja.
  // Pas d'explorateur de fichiers ici : une photo de profil vient de l'appareil
  // photo ou de la phototheque.
  function onSubmit(values: AccountProfileFormValues) {
    updateAccount.mutate({
      username: values.username,
      first_name: values.first_name,
      last_name: values.last_name,
      profile: { default_hourly_rate: normalizeAmountInput(values.default_hourly_rate) },
    });
  }

  return (
    <View className="gap-4">
      <Text className="text-[11px] font-medium uppercase text-muted">Profil</Text>

      <View className="flex-row items-center gap-4">
        <MemberAvatar name={displayName} pictureUrl={user?.profile?.picture_url} size={64} />
        {/* Pendant l'envoi le declencheur sort du menu : `MenuView` n'a pas d'etat
            desactive, et un menu ouvert sur une photo deja en cours d'upload
            ecraserait la mutation en vol. */}
        {uploadPicture.isPending ? (
          <View className="h-11 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3">
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text className="text-sm font-medium text-foreground">Envoi...</Text>
          </View>
        ) : (
          <UploadMenu
            onPicked={([file]) => {
              setPictureError(null);
              uploadPicture.mutate(file, {
                onError: (error) => setPictureError(getErrorMessage(error)),
              });
            }}
            allowsEditing
            includeFiles={false}
          >
            <View
              accessibilityRole="button"
              className="h-11 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3"
            >
              <Camera size={theme.iconSize.sm} color={theme.colors.foreground} />
              <Text className="text-sm font-medium text-foreground">Modifier la photo</Text>
            </View>
          </UploadMenu>
        )}
      </View>

      {pictureError ? <ErrorState message={pictureError} /> : null}

      <View className="gap-1 rounded-md border border-border bg-surface p-4">
        <Text className="text-xs text-muted">Email</Text>
        <Text className="text-base font-medium text-foreground">{user?.email || "-"}</Text>
      </View>

      <InlineMessage variant="danger">{getErrorMessage(updateAccount.error)}</InlineMessage>

      <Controller
        control={form.control}
        name="username"
        render={({ field, fieldState }) => (
          <FormField
            label="Identifiant"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        )}
      />

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
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={form.control}
        name="last_name"
        render={({ field, fieldState }) => (
          <FormField
            label="Nom"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="words"
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={form.control}
        name="default_hourly_rate"
        render={({ field, fieldState }) => (
          <FormField
            label="Taux horaire par defaut (EUR/h)"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        )}
      />

      <Button onPress={form.handleSubmit(onSubmit)} disabled={updateAccount.isPending}>
        {updateAccount.isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </View>
  );
}

function PasswordSection() {
  const changePassword = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: "", new_password: "" },
  });

  useServerFieldErrors(form, changePassword.error, ["old_password", "new_password"]);

  return (
    <View className="gap-4 border-t border-border pt-6">
      <Text className="text-[11px] font-medium uppercase text-muted">Securite</Text>

      <InlineMessage variant="danger">{getErrorMessage(changePassword.error)}</InlineMessage>
      {changePassword.isSuccess ? <InlineMessage>Mot de passe mis a jour.</InlineMessage> : null}

      <Controller
        control={form.control}
        name="old_password"
        render={({ field, fieldState }) => (
          <FormField
            label="Mot de passe actuel"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            returnKeyType="next"
          />
        )}
      />

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
            autoComplete="new-password"
            returnKeyType="done"
          />
        )}
      />

      <Button
        onPress={form.handleSubmit((values) =>
          changePassword.mutate(values, { onSuccess: () => form.reset() }),
        )}
        disabled={changePassword.isPending}
      >
        {changePassword.isPending ? "Enregistrement..." : "Changer le mot de passe"}
      </Button>
    </View>
  );
}
