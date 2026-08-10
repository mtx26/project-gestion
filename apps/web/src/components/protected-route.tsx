"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { buildLoginUrl } from "@/lib/next-path";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    // La page demandee est memorisee dans `?next=` pour y revenir apres
    // connexion — sinon un lien profond (ex. invitation avec son token)
    // serait perdu et l'utilisateur atterrirait sur le dashboard.
    const query = searchParams.toString();
    router.replace(buildLoginUrl(query ? `${pathname}?${query}` : pathname));
  }, [isAuthenticated, isLoading, pathname, searchParams, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="size-5 animate-spin text-teal-700" />
      </div>
    );
  }

  return children;
}
