"use client";

import { ApiError } from "@project-gestion/api";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, toastError } from "@/lib/errors";
import { invalidateProjectResource } from "@/lib/invalidate-project-resource";

/** One mutation, wired to the shared convention used across every feature: toast on
 * success, invalidate the resource (if any — some mutations only update the auth
 * store, e.g. `changePassword`/`updateProfile`, and have nothing to invalidate),
 * then run whatever dialog/local-state cleanup the caller needs; toastError on
 * failure. Mirrors `useTrashResource`'s restore mutation for the non-trash case.
 *
 * `successMessage` is omitted for reads that shouldn't be confirmed by a toast
 * (e.g. fetching a linked entity's detail on click). `errorMessage` overrides the
 * default `toastError` for that same read case: it prefers the API's own message
 * (a 403/404 detail is more useful than a generic line) and only falls back to
 * the caller's contextual message for non-API failures, where the raw error text
 * wouldn't mean anything to the user. */
export function useCrudMutation<TVariables, TData = unknown>({
  mutationFn,
  invalidateKey,
  successMessage,
  errorMessage,
  onSuccess,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKey?: QueryKey | QueryKey[];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
}) {
  const queryClient = useQueryClient();
  const invalidateKeys = !invalidateKey
    ? []
    : Array.isArray(invalidateKey[0])
      ? (invalidateKey as QueryKey[])
      : [invalidateKey as QueryKey];

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      if (successMessage) toast.success(successMessage);
      await Promise.all(invalidateKeys.map((key) => invalidateProjectResource(queryClient, key)));
      onSuccess?.(data, variables);
    },
    onError: (error: unknown) => {
      if (!errorMessage) {
        toastError(error);
        return;
      }
      const apiMessage = error instanceof ApiError ? getErrorMessage(error) : null;
      toast.error(apiMessage ?? errorMessage);
    },
  });
}
