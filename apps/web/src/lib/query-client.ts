import { ApiError } from "@project-gestion/api";
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      },
    },
  });
}

