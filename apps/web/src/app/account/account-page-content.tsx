"use client";

import { changePasswordSchema, type ChangePasswordFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@project-gestion/types";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { AccountProfileForm } from "@/app/account/components/account-profile-form";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { FormError } from "@/components/forms/form-error";
import { PageTitle } from "@/components/page-title";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";

export function AccountPageContent() {
  return (
    <ProjectWorkspaceShell maxWidthClassName="max-w-none">
      {({ user }) => <AccountView user={user} />}
    </ProjectWorkspaceShell>
  );
}

function AccountView({ user }: { user: User | null }) {
  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "" },
  });

  const changePassword = useCrudMutation({
    mutationFn: api.auth.changePassword,
    successMessage: "Mot de passe mis a jour",
    onSuccess: () => passwordForm.reset(),
  });
  useServerFieldErrors(passwordForm, changePassword.error, ["current_password", "new_password"]);

  function onChangePassword(values: ChangePasswordFormValues) {
    changePassword.mutate(values);
  }

  return (
        <div className="space-y-5">
          <PageTitle category="Compte" title="Parametres du compte" />

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
                  <AccountProfileForm user={user} />
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
                      <FieldLabel htmlFor="current-password">Mot de passe actuel</FieldLabel>
                      <PasswordInput id="current-password" autoComplete="current-password" {...passwordForm.register("current_password")} />
                      <FieldError errors={[passwordForm.formState.errors.current_password]} />
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
