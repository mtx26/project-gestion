"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

