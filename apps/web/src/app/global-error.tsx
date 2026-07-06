"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import "./globals.css";

export default function GlobalError({
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
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <div className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
          <Empty className="border bg-card p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle className="size-4" />
              </EmptyMedia>
              <EmptyTitle>Une erreur est survenue</EmptyTitle>
              <EmptyDescription>
                L&apos;application a rencontre un probleme inattendu. Tu peux reessayer.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={reset}>Reessayer</Button>
            </EmptyContent>
          </Empty>
        </div>
      </body>
    </html>
  );
}
