"use client";

import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { ProjectPageFallback } from "@/components/dashboard/project-page-fallback";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export default function InvitationAcceptPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <InvitationAcceptContent />
    </Suspense>
  );
}

function InvitationAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <ProjectWorkspaceShell activeItem="notifications" maxWidthClassName="max-w-2xl">
      {() => <InvitationAcceptPanel token={token} />}
    </ProjectWorkspaceShell>
  );
}

function InvitationAcceptPanel({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const hasStartedAccept = useRef(false);
  const acceptInvitation = useMutation({
    mutationFn: api.invitations.accept,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ]);
    },
  });

  useEffect(() => {
    if (token && !hasStartedAccept.current) {
      hasStartedAccept.current = true;
      acceptInvitation.mutate(token);
    }
  }, [acceptInvitation, token]);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Invitation projet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <FormError message="Lien d'invitation invalide: token manquant." />
        ) : acceptInvitation.isPending || acceptInvitation.status === "idle" ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Acceptation de l&apos;invitation...
          </div>
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
        ) : (
          <FormError message={getErrorMessage(acceptInvitation.error)} />
        )}
      </CardContent>
    </Card>
  );
}
