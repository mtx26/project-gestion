"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/** Fetches a linked entity's detail on demand (e.g. clicking a task/time-entry
 * reference from another feature), toasting on failure and exposing `isPending`
 * so the caller can show a loading state while the detail modal opens. */
export function useLazyDetailFetch<T>(
  fetchFn: (id: number) => Promise<T>,
  onSuccess: (data: T) => void,
  errorMessage: string,
) {
  const mutation = useMutation({
    mutationFn: fetchFn,
    onSuccess,
    onError: () => toast.error(errorMessage),
  });
  return { open: mutation.mutate, isPending: mutation.isPending };
}
