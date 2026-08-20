import { buildNotificationsListQuery, getApiCount, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { Notification, PaginatedResponse } from "@project-gestion/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

/** Compteur de la cloche du header. Sa cle est un enfant de `notifications.all` :
 * marquer lu (ou tout marquer lu) l'invalide donc au passage. */
export function useUnreadNotificationsCount(): number {
  const query = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => api.notifications.unreadCount(),
  });

  return query.data?.count ?? 0;
}

export function useNotificationsInfinite(unreadOnly: boolean) {
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.notifications.list(unreadOnly), "infinite"],
    queryFn: ({ pageParam }) => buildNotificationsListQuery(api, unreadOnly, pageParam).queryFn(),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (Array.isArray(lastPage)) {
        return undefined;
      }
      return (lastPage as PaginatedResponse<Notification>).next ? allPages.length + 1 : undefined;
    },
  });

  const notifications = (query.data?.pages ?? []).flatMap((page) => normalizeApiList(page));
  const count = getApiCount(query.data?.pages?.[0]);

  return { ...query, notifications, count };
}

/** Marquer lu recharge toute la branche `notifications` : la liste, mais aussi le
 * compteur de la cloche du header. */
function useNotificationsInvalidation() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
}

export function useMarkNotificationRead() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: (id: number) => api.notifications.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useNotificationsInvalidation();

  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: invalidate,
  });
}

/** Acceptation d'une invitation depuis sa notification : le serveur marque lui-meme
 * la notification comme traitee, et l'utilisateur gagne un projet — d'ou les deux
 * branches invalidees. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => api.invitations.accept(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}
