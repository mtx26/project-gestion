"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <ProtectedRoute>
      <main className="min-h-dvh bg-slate-50 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Button asChild variant="ghost">
            <Link href="/dashboard">Retour</Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Parametres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>Email: {user?.email}</p>
              <p>Nom: {[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </ProtectedRoute>
  );
}

