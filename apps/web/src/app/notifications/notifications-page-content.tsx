"use client";

import type { Notification, PaginatedResponse } from "@project-gestion/types";
import { buildNotificationsListQuery, getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { Bell, Check, MailOpen } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { formatDateTime } from "@/lib/date-utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterBar, FilterClear, FilterToggle } from "@/components/filters/filter-bar";
import { ItemGroup } from "@/components/ui/item";
import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";
import { parseBooleanParam, parsePageParam } from "@/lib/url-params";
import { useUrlFilter } from "@/lib/use-url-filter";

type NotificationsData = Notification[] | PaginatedResponse<Notification> | undefined;

/** Applies `updateList` to whichever shape the cache currently holds (plain array or paginated). */
function withUpdatedNotifications(
  data: NotificationsData,
  updateList: (list: Notification[]) => Notification[],
): NotificationsData {
  if (!data) return data;
  if (Array.isArray(data)) return updateList(data);
  return { ...data, results: updateList(data.results) };
}

/** Deliberate exception to the invalidate-after-success convention every other
 * mutation in the app uses: marking a notification read needs to feel instant (it
 * fires on every click in a list), so this optimistically updates the cache via
 * onMutate/rollback instead of waiting on a refetch. Shared by `markRead` and
 * `markAllRead` since both need the same cancel/snapshot/rollback/invalidate shape. */
function useOptimisticNotificationsMutation<TVariables>(
  queryClient: QueryClient,
  listKey: QueryKey,
  mutationFn: (variables: TVariables) => Promise<unknown>,
  updateList: (list: Notification[], variables: TVariables) => Notification[],
) {
  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<NotificationsData>(listKey);
      queryClient.setQueryData<NotificationsData>(listKey, (data) =>
        withUpdatedNotifications(data, (list) => updateList(list, variables)),
      );
      return { previous };
    },
    onError: (err: unknown, _variables: TVariables, context: { previous?: NotificationsData } | undefined) => {
      if (context?.previous !== undefined) queryClient.setQueryData(listKey, context.previous);
      toastError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function NotificationsPageContent() {
  return (
    <ProjectWorkspaceShell maxWidthClassName="max-w-none">
      {() => <NotificationsView />}
    </ProjectWorkspaceShell>
  );
}

function NotificationsView() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const unreadOnly = parseBooleanParam(searchParams.get("unread"));
  const page = parsePageParam(searchParams.get("page"));
  const updateUrlFilter = useUrlFilter("/notifications", searchParams, null);

  const notificationsQuery = useQuery({
    ...buildNotificationsListQuery(api, unreadOnly, page),
    placeholderData: keepPreviousData,
  });
  const currentListKey = queryKeys.notifications.list(unreadOnly, page);
  const markRead = useOptimisticNotificationsMutation(
    queryClient,
    currentListKey,
    api.notifications.markRead,
    (list, id: number) =>
      unreadOnly
        ? list.filter((notification) => notification.id !== id)
        : list.map((notification) => (notification.id === id ? { ...notification, is_read: true } : notification)),
  );
  const markAllRead = useOptimisticNotificationsMutation<void>(
    queryClient,
    currentListKey,
    () => api.notifications.markAllRead(),
    (list) => (unreadOnly ? [] : list.map((notification) => ({ ...notification, is_read: true }))),
  );

  const notifications = normalizeApiList(notificationsQuery.data);
  const totalCount = getApiCount(notificationsQuery.data);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTitle category="Notifications" title="Centre de notifications" />
          <p className="mt-2 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s).` : "Tout est lu."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          <MailOpen className="size-4" />
          Tout marquer lu
        </Button>
      </div>

      <FilterBar>
        <FilterToggle
          pressed={unreadOnly}
          onPressedChange={(pressed) => updateUrlFilter({ unread: pressed })}
        >
          Non lues uniquement
        </FilterToggle>
        <FilterClear path="/notifications" removeKeys={["unread", "page"]} />
      </FilterBar>

      <FormError
        message={
          getErrorMessage(notificationsQuery.error) ??
          getErrorMessage(markRead.error) ??
          getErrorMessage(markAllRead.error)
        }
      />

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Liste des notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 && !notificationsQuery.isLoading ? (
            <Empty className="border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell className="size-4" />
                </EmptyMedia>
                <EmptyTitle>Aucune notification</EmptyTitle>
                <EmptyDescription>Les invitations et changements importants apparaitront ici.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ItemGroup>
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    isUpdating={markRead.isPending}
                    onMarkRead={() => markRead.mutate(notification.id)}
                  />
                ))}
              </ItemGroup>
              <PaginationBar count={totalCount} page={page} pageSize={getApiPageSize(notificationsQuery.data)} onPageChange={(p) => updateUrlFilter({ page: p })} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  isUpdating,
  notification,
  onMarkRead,
}: {
  isUpdating: boolean;
  notification: Notification;
  onMarkRead: () => void;
}) {
  const invitationToken = getInvitationToken(notification);

  return (
    <div className={notification.is_read ? "p-4" : "bg-primary/5 p-4"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {!notification.is_read ? <Badge>Non lu</Badge> : null}
            <p className="font-medium">{notification.title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{notification.message}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(notification.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {invitationToken ? (
            <Button asChild size="sm">
              <Link href={`/invitations/accept?token=${encodeURIComponent(invitationToken)}`}>
                Accepter
              </Link>
            </Button>
          ) : null}
          {!notification.is_read ? (
            <Button type="button" variant="outline" size="sm" disabled={isUpdating} onClick={onMarkRead}>
              <Check className="size-4" />
              Lu
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getInvitationToken(notification: Notification) {
  if (notification.type !== "project_invitation") {
    return null;
  }

  const token = notification.data.token;
  return typeof token === "string" ? token : null;
}
