"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Empty className="border bg-card p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Une erreur est survenue</EmptyTitle>
          <EmptyDescription>
            Quelque chose s&apos;est mal passe. Tu peux reessayer, ou revenir plus tard si le probleme persiste.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>Reessayer</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
