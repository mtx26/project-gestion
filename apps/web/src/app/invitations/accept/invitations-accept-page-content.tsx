"use client";

import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buildAppInvitationUrl } from "@project-gestion/domain";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFieldError } from "@project-gestion/api";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export function InvitationsAcceptPageContent() {
  return (
    <ProjectWorkspaceShell>
      {() => <InvitationsAcceptView />}
    </ProjectWorkspaceShell>
  );
}

function InvitationsAcceptView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const queryClient = useQueryClient();
  const acceptedToken = useRef<string | null>(null);
  const acceptInvitation = useMutation({
    mutationFn: api.invitations.accept,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
  const { mutate } = acceptInvitation;

  // Le garde retient le token deja envoye plutot qu'un simple booleen remis a zero au
  // cleanup : sinon le double montage de StrictMode (dev) relance l'acceptation, et les
  // deux POST concurrents se marchent dessus cote serveur. Un nouveau token relance bien
  // la mutation.
  useEffect(() => {
    if (!token || acceptedToken.current === token) return;
    acceptedToken.current = token;
    mutate(token);
  }, [token, mutate]);

  // L'email ne contient qu'un lien web (il doit marcher partout) : c'est ici, sur un
  // telephone, qu'on tente de passer la main a l'application. Si elle n'est pas
  // installee, rien ne se passe et l'acceptation web ci-dessus suit son cours —
  // l'endpoint est idempotent, donc l'app peut la rejouer sans risque.
  const appUrl = token ? buildAppInvitationUrl(token) : null;
  useEffect(() => {
    if (!appUrl || !isMobileBrowser()) return;
    window.location.href = appUrl;
  }, [appUrl]);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Invitations</p>
        <h1 className="mt-1 text-2xl font-semibold">Rejoindre un projet</h1>
      </div>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Invitation projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <FormError message="Lien d'invitation invalide: token manquant." />
          ) : acceptInvitation.isSuccess ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border bg-primary/5 p-4">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="font-medium">Invitation acceptee</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tu as maintenant acces au projet.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link href="/dashboard">Aller au dashboard</Link>
              </Button>
            </div>
          ) : acceptInvitation.isError ? (
            <FormError
              message={
                getFieldError(acceptInvitation.error, "token") ??
                getErrorMessage(acceptInvitation.error)
              }
            />
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Acceptation de l&apos;invitation...
            </div>
          )}

          {appUrl ? (
            <Button asChild variant="outline">
              <a href={appUrl}>
                <Smartphone className="size-4" />
                Ouvrir dans l&apos;application
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Telephone ou tablette : la seule question qui compte ici est "l'application
 * mobile peut-elle exister sur cet appareil", pas le navigateur exact. */
function isMobileBrowser() {
  return typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}
