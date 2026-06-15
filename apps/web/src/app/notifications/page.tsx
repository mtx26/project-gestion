"use client";

import type { Notification } from "@project-gestion/types";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, MailOpen } from "lucide-react";
import Link from "next/link";
import { ProjectWorkspaceShell } from "@/components/dashboard/project-workspace-shell";
import { FormError } from "@/components/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export default function NotificationsPage() {
  return (
    <ProjectWorkspaceShell activeItem="notifications" maxWidthClassName="max-w-none">
      {() => <NotificationsContent />}
    </ProjectWorkspaceShell>
  );
}

function NotificationsContent() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list(false),
    queryFn: () => api.notifications.list(),
  });
  const markRead = useMutation({
    mutationFn: api.notifications.markRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
  const markAllRead = useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const notifications = normalizeApiList(notificationsQuery.data);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Notifications</p>
          <h1 className="mt-1 text-2xl font-semibold">Centre de notifications</h1>
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

      <FormError
        message={
          notificationsQuery.error
            ? getErrorMessage(notificationsQuery.error)
            : markRead.error
              ? getErrorMessage(markRead.error)
              : markAllRead.error
                ? getErrorMessage(markAllRead.error)
                : null
        }
      />

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Liste</CardTitle>
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
            <div className="divide-y rounded-md border">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  isUpdating={markRead.isPending}
                  onMarkRead={() => markRead.mutate(notification.id)}
                />
              ))}
            </div>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
