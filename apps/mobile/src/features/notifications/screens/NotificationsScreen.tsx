import type { Notification } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { MailOpen } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { TogglePill } from "../../../components/filters/TogglePill";
import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
import { useAcceptInvitation } from "../../invitations/hooks/use-accept-invitation";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsInfinite,
} from "../hooks/use-notifications";

/** Jeton porte par une notification d'invitation — la seule notification qui ouvre
 * sur une action plutot que sur une simple lecture. */
function getInvitationToken(notification: Notification): string | null {
  if (notification.type !== "project_invitation") {
    return null;
  }
  const token = notification.data.token;
  return typeof token === "string" ? token : null;
}

export function NotificationsScreen() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const {
    notifications,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useNotificationsInfinite(unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const acceptInvitation = useAcceptInvitation();

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  function accept(token: string) {
    Alert.alert("Rejoindre le projet", "Accepter cette invitation ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Accepter",
        onPress: () => acceptInvitation.mutate(token),
      },
    ]);
  }

  function handlePress(notification: Notification) {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    const token = getInvitationToken(notification);
    if (token) {
      accept(token);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-row items-center justify-between gap-2 px-5 pt-4">
        <Text className="text-2xl font-semibold text-foreground">Notifications</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="h-11 justify-center">
          <Text className="text-base font-semibold text-primary">Fermer</Text>
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          notifications.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12 }
            : { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }
        }
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={() => refetch()} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <Text className="text-sm text-muted">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}.` : "Tout est lu."}
            </Text>

            <View className="flex-row items-center gap-2">
              <TogglePill
                label="Non lues uniquement"
                active={unreadOnly}
                onPress={() => setUnreadOnly((value) => !value)}
              />
            </View>

            <Button
              variant="secondary"
              onPress={() => markAllRead.mutate()}
              disabled={unreadCount === 0 || markAllRead.isPending}
            >
              Tout marquer lu
            </Button>

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}
            {acceptInvitation.error ? (
              <ErrorState message={getErrorMessage(acceptInvitation.error)} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState
              title="Aucune notification"
              description="Les invitations et changements importants apparaitront ici."
            />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingState /> : null}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            isAccepting={acceptInvitation.isPending}
            onPress={() => handlePress(item)}
            onAccept={(token) => accept(token)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function NotificationRow({
  notification,
  isAccepting,
  onPress,
  onAccept,
}: {
  notification: Notification;
  isAccepting: boolean;
  onPress: () => void;
  onAccept: (token: string) => void;
}) {
  const invitationToken = getInvitationToken(notification);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className={`gap-1.5 rounded-md border border-border p-4 ${
        notification.is_read ? "bg-surface" : "bg-primary/5"
      }`}
    >
      <View className="flex-row items-center gap-2">
        {notification.is_read ? null : <View className="h-2 w-2 rounded-full bg-primary" />}
        <Text className="flex-1 text-base font-semibold text-foreground">{notification.title}</Text>
      </View>
      <Text className="text-sm text-muted">{notification.message}</Text>
      <Text className="text-xs text-muted">{formatDateTime(notification.created_at)}</Text>

      {invitationToken ? (
        <View className="flex-row items-center gap-2 pt-2">
          <MailOpen size={theme.iconSize.sm} color={theme.colors.primary} />
          <Pressable
            onPress={() => onAccept(invitationToken)}
            disabled={isAccepting}
            accessibilityRole="button"
            className="h-9 justify-center"
          >
            <Text className="text-sm font-semibold text-primary">
              {isAccepting ? "Acceptation..." : "Accepter l'invitation"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}
