"use client";

import type { User } from "@project-gestion/types";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountProfileForm } from "@/app/account/components/account-profile-form";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSafeNextPath } from "@/lib/next-path";

export function AccountSetupPageContent() {
  return (
    <ProjectWorkspaceShell maxWidthClassName="max-w-3xl">
      {({ user }) => <AccountSetupView user={user} />}
    </ProjectWorkspaceShell>
  );
}

function AccountSetupView({ user }: { user: User | null }) {
  const router = useRouter();
  // Page initialement demandee (ex. lien d'invitation), transportee depuis le
  // login pour ne pas la perdre en passant par cet ecran.
  const nextPath = getSafeNextPath(useSearchParams().get("next")) ?? "/dashboard";

  return (
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
            showNameFields={true}
            onProfileSaved={() => router.replace(nextPath)}
          />
          <div className="mt-4">
            <Button type="button" variant="ghost" onClick={() => router.replace(nextPath)}>
              Plus tard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
