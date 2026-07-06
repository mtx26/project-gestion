"use client";

import { changePasswordSchema, type ChangePasswordFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@project-gestion/types";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AccountProfileForm } from "@/app/account/components/account-profile-form";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { FormError } from "@/components/forms/form-error";
import { PageTitle } from "@/components/page-title";
import { PasswordInput } from "@/components/forms/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";

export function AccountPageContent() {
  return (
    <ProjectWorkspaceShell maxWidthClassName="max-w-none">
      {({ user }) => <AccountView user={user} />}
    </ProjectWorkspaceShell>
  );
}

function AccountView({ user }: { user: User | null }) {
  const [notice, setNotice] = useState<string | null>(null);
  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: "", new_password: "" },
  });

  const changePassword = useMutation({
    mutationFn: api.auth.changePassword,
    onSuccess: () => {
      passwordForm.reset();
      setNotice("Mot de passe mis a jour.");
    },
    onError: toastError,
  });

  function onChangePassword(values: ChangePasswordFormValues) {
    changePassword.mutate(values);
  }

  return (
        <div className="space-y-5">
          <PageTitle category="Compte" title="Parametres du compte" />

          {notice ? (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="profile">
            <div>
              <TabsList className="h-auto w-max">
                <TabsTrigger value="profile" className="min-w-28 flex-none px-3 py-2">
                  Profil
                </TabsTrigger>
                <TabsTrigger value="security" className="min-w-28 flex-none px-3 py-2">
                  Securite
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="profile">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>Informations generales</CardTitle>
                </CardHeader>
                <CardContent>
                  <AccountProfileForm
                    user={user}
                    onProfileSaved={() => setNotice("Profil mis a jour.")}
                    onPictureSaved={() => setNotice("Photo de profil mise a jour.")}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>Mot de passe</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="max-w-md space-y-4" onSubmit={passwordForm.handleSubmit(onChangePassword)}>
                    <Field>
                      <FieldLabel htmlFor="old-password">Mot de passe actuel</FieldLabel>
                      <PasswordInput id="old-password" autoComplete="current-password" {...passwordForm.register("old_password")} />
                      <FieldError errors={[passwordForm.formState.errors.old_password]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-password">Nouveau mot de passe</FieldLabel>
                      <PasswordInput id="new-password" autoComplete="new-password" {...passwordForm.register("new_password")} />
                      <FieldError errors={[passwordForm.formState.errors.new_password]} />
                    </Field>
                    <FormError message={getErrorMessage(changePassword.error)} />
                    <Button type="submit" disabled={changePassword.isPending}>
                      <Save className="size-4" />
                      {changePassword.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
  );
}
