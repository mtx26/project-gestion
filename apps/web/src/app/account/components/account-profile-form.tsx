"use client";

import type { User } from "@project-gestion/types";
import { accountProfileSchema, type AccountProfileFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ProfilePictureEditorDialog } from "@/app/account/components/profile-picture-editor-dialog";
import { FormError } from "@/components/forms/form-error";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/forms/money-input";
import { MutedInfoCard } from "@/components/muted-info-card";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { getInitials } from "@/lib/user-display";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { useAuthStore } from "@/stores/auth-store";

interface AccountProfileFormProps {
  user: User | null;
  submitLabel?: string;
  showEmail?: boolean;
  showNameFields?: boolean;
  onProfileSaved?: () => void;
  onPictureSaved?: () => void;
}

export function AccountProfileForm({
  user,
  submitLabel = "Enregistrer",
  showEmail = true,
  showNameFields = true,
  onProfileSaved,
  onPictureSaved,
}: AccountProfileFormProps) {
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [pictureEditorOpen, setPictureEditorOpen] = useState(false);

  const form = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: getAccountProfileValues(user),
  });
  const [username, firstName, lastName] = useWatch({
    control: form.control,
    name: ["username", "first_name", "last_name"],
  });
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || username || "Compte";

  const updateProfile = useCrudMutation<AccountProfileFormValues, User>({
    mutationFn: (values) =>
      api.auth.updateMe({
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        profile: { default_hourly_rate: values.default_hourly_rate },
      }),
    successMessage: "Profil mis a jour",
    onSuccess: (updatedUser) => {
      useAuthStore.setState({ user: updatedUser });
      form.reset(getAccountProfileValues(updatedUser));
      onProfileSaved?.();
    },
  });
  useServerFieldErrors(form, updateProfile.error, ["username", "first_name", "last_name"]);

  const uploadPicture = useMutation({
    mutationFn: (file: File) => api.auth.uploadProfilePicture(file),
    onMutate: () => setPictureError(null),
    onSuccess: (updatedUser) => {
      toast.success("Photo de profil mise a jour");
      useAuthStore.setState({ user: updatedUser });
      onPictureSaved?.();
    },
    onError: (error) => setPictureError(getErrorMessage(error)),
  });

  function onSubmit(values: AccountProfileFormValues) {
    updateProfile.mutate(values);
  }

  function onPictureChange(file: File | undefined) {
    if (!file) {
      return;
    }

    setPictureError(null);
    setPictureFile(file);
    setPictureEditorOpen(true);
  }

  function onEditedPictureReady(file: File) {
    uploadPicture.mutate(file, {
      onSuccess: () => {
        setPictureEditorOpen(false);
        setPictureFile(null);
      },
    });
  }

  return (
    <form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="sm:col-span-2">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border">
            {user?.profile?.picture_url ? <AvatarImage src={user.profile.picture_url} alt="" /> : null}
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Label htmlFor="account-picture" className="mb-2 block">Photo de profil</Label>
            <Button asChild type="button" variant="outline" size="sm" disabled={uploadPicture.isPending}>
              <label htmlFor="account-picture" className="cursor-pointer">
                <Camera className="size-4" />
                {uploadPicture.isPending ? "Upload..." : "Modifier"}
              </label>
            </Button>
            <Input
              id="account-picture"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                onPictureChange(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <FormError message={pictureError} />
          </div>
        </div>
      </div>

      {showEmail ? <InfoBlock label="Email" value={user?.email || "-"} /> : null}
      <Field>
        <FieldLabel htmlFor="account-username">Identifiant</FieldLabel>
        <Input id="account-username" {...form.register("username")} />
        <FieldError errors={[form.formState.errors.username]} />
      </Field>
      {showNameFields ? (
        <>
          <Field>
            <FieldLabel htmlFor="account-first-name">Prenom</FieldLabel>
            <Input id="account-first-name" {...form.register("first_name")} />
            <FieldError errors={[form.formState.errors.first_name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-last-name">Nom</FieldLabel>
            <Input id="account-last-name" {...form.register("last_name")} />
            <FieldError errors={[form.formState.errors.last_name]} />
          </Field>
        </>
      ) : null}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="account-default-rate">Taux horaire par defaut</FieldLabel>
        <MoneyInput id="account-default-rate" {...form.register("default_hourly_rate")} />
      </Field>
      <div className="sm:col-span-2">
        <FormError message={getErrorMessage(updateProfile.error)} />
        <FormSubmitButton
          pending={updateProfile.isPending}
          disabled={updateProfile.isPending}
          label={submitLabel}
          pendingLabel="Enregistrement..."
        />
      </div>
      <ProfilePictureEditorDialog
        key={pictureFile ? `${pictureFile.name}-${pictureFile.size}-${pictureFile.lastModified}` : "profile-picture-editor"}
        file={pictureFile}
        isPending={uploadPicture.isPending}
        open={pictureEditorOpen}
        onConfirm={onEditedPictureReady}
        onOpenChange={(open) => {
          setPictureEditorOpen(open);
          if (!open) {
            setPictureFile(null);
          }
        }}
      />
    </form>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <MutedInfoCard>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </MutedInfoCard>
  );
}

function getAccountProfileValues(user: User | null | undefined): AccountProfileFormValues {
  return {
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    default_hourly_rate: user?.profile?.default_hourly_rate ?? "0",
  };
}
