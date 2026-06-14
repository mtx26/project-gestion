"use client";

import { changePasswordSchema, type ChangePasswordFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/form-error";
import { AppHeader } from "@/components/app-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

export default function AccountPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
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
  });

  async function onLogout() {
    await logout();
    queryClient.clear();
    window.location.assign("/auth/login");
  }

  function onChangePassword(values: ChangePasswordFormValues) {
    changePassword.mutate(values);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-dvh bg-background text-foreground">
        <AppHeader user={user} onLogout={onLogout} backHref="/dashboard" />
        <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Compte</p>
            <h1 className="mt-1 text-2xl font-semibold">Parametres du compte</h1>
          </div>

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
                  <CardTitle>Profil</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoBlock label="Email" value={user?.email || "-"} />
                  <InfoBlock label="Nom" value={[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "-"} />
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
                    <div className="space-y-2">
                      <Label htmlFor="old-password">Mot de passe actuel</Label>
                      <Input id="old-password" type="password" {...passwordForm.register("old_password")} />
                      <FormError message={passwordForm.formState.errors.old_password?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <Input id="new-password" type="password" {...passwordForm.register("new_password")} />
                      <FormError message={passwordForm.formState.errors.new_password?.message} />
                    </div>
                    <FormError message={changePassword.error ? getErrorMessage(changePassword.error) : null} />
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
      </main>
    </ProtectedRoute>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
