"use client";

import type { User } from "@project-gestion/types";
import { useMutation } from "@tanstack/react-query";
import { Camera, Save } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ProfilePictureEditorDialog } from "@/components/account/profile-picture-editor-dialog";
import { FormError } from "@/components/form-error";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

type AccountProfileFormProps = {
  user: User | null;
  submitLabel?: string;
  showEmail?: boolean;
  showNameFields?: boolean;
  onProfileSaved?: () => void;
  onPictureSaved?: () => void;
};

export function AccountProfileForm({
  user,
  submitLabel = "Enregistrer",
  showEmail = true,
  showNameFields = true,
  onProfileSaved,
  onPictureSaved,
}: AccountProfileFormProps) {
  const [profileDraft, setProfileDraft] = useState<AccountProfileValues | null>(null);
  const profileValues = profileDraft ?? getAccountProfileValues(user);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [pictureEditorOpen, setPictureEditorOpen] = useState(false);
  const displayName = [profileValues.first_name, profileValues.last_name].filter(Boolean).join(" ") || profileValues.username || "Compte";

  const updateProfile = useMutation({
    mutationFn: () =>
      api.auth.updateMe({
        username: profileValues.username.trim(),
        first_name: profileValues.first_name.trim(),
        last_name: profileValues.last_name.trim(),
        profile: {
          default_hourly_rate: profileValues.default_hourly_rate || "0",
        },
      }),
    onSuccess: (updatedUser) => {
      toast.success("Profil mis a jour");
      useAuthStore.setState({ user: updatedUser });
      setProfileDraft(getAccountProfileValues(updatedUser));
      onProfileSaved?.();
    },
  });

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

  function onSubmitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate();
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
    <form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={onSubmitProfile}>
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
        <Input
          id="account-username"
          value={profileValues.username}
          onChange={(event) => setProfileDraft({ ...profileValues, username: event.target.value })}
        />
      </Field>
      {showNameFields ? (
        <>
          <Field>
            <FieldLabel htmlFor="account-first-name">Prenom</FieldLabel>
            <Input
              id="account-first-name"
              value={profileValues.first_name}
              onChange={(event) => setProfileDraft({ ...profileValues, first_name: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="account-last-name">Nom</FieldLabel>
            <Input
              id="account-last-name"
              value={profileValues.last_name}
              onChange={(event) => setProfileDraft({ ...profileValues, last_name: event.target.value })}
            />
          </Field>
        </>
      ) : null}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="account-default-rate">Taux horaire par defaut</FieldLabel>
        <Input
          id="account-default-rate"
          type="number"
          min="0"
          step="0.01"
          value={profileValues.default_hourly_rate}
          onChange={(event) => setProfileDraft({ ...profileValues, default_hourly_rate: event.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <FormError message={updateProfile.error ? getErrorMessage(updateProfile.error) : null} />
        <Button type="submit" disabled={updateProfile.isPending}>
          <Save className="size-4" />
          {updateProfile.isPending ? "Enregistrement..." : submitLabel}
        </Button>
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
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

type AccountProfileValues = {
  username: string;
  first_name: string;
  last_name: string;
  default_hourly_rate: string;
};

function getAccountProfileValues(user: User | null | undefined): AccountProfileValues {
  return {
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    default_hourly_rate: user?.profile?.default_hourly_rate ?? "0",
  };
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
