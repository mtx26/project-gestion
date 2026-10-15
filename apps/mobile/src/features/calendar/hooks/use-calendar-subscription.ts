import { ApiError } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { CalendarSubscriptionPayload } from "@project-gestion/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Un projet sans abonnement repond 404 : ce n'est pas une erreur a afficher, juste
 * "pas encore de lien". */
export function useCalendarSubscription(projectId: number | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.calendar.subscription(projectId) : queryKeys.disabled(),
    queryFn: async () => {
      try {
        return await api.calendar.getSubscription(projectId!);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(projectId),
  });
}

function useSubscriptionInvalidation(projectId: number | null) {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.calendar.subscription(projectId!) });
}

/** Meme endpoint pour creer et mettre a jour : le serveur remplace l'abonnement du
 * projet (et donc son jeton) a chaque appel. */
export function useSaveCalendarSubscription(projectId: number | null) {
  const invalidate = useSubscriptionInvalidation(projectId);

  return useMutation({
    mutationFn: (payload: CalendarSubscriptionPayload) =>
      api.calendar.createSubscription(projectId!, payload),
    onSuccess: invalidate,
  });
}

export function useRevokeCalendarSubscription(projectId: number | null) {
  const invalidate = useSubscriptionInvalidation(projectId);

  return useMutation({
    mutationFn: () => api.calendar.deleteSubscription(projectId!),
    onSuccess: invalidate,
  });
}
