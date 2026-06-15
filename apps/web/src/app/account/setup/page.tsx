"use client";

import { useRouter } from "next/navigation";
import { AccountProfileForm } from "@/components/account/account-profile-form";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountSetupPage() {
  const router = useRouter();

  return (
    <ProjectWorkspaceShell activeItem="account" maxWidthClassName="max-w-3xl">
      {({ user }) => (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Bienvenue</p>
            <h1 className="mt-1 text-2xl font-semibold">Complete les infos utiles</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Ajoute seulement les informations qui ne sont pas demandees pendant l&apos;inscription.
            </p>
          </div>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Profil de travail</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountProfileForm
                user={user}
                submitLabel="Terminer"
                showEmail={false}
                showNameFields={false}
                onProfileSaved={() => router.replace("/dashboard")}
              />
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => router.replace("/dashboard")}>
                  Plus tard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ProjectWorkspaceShell>
  );
}
