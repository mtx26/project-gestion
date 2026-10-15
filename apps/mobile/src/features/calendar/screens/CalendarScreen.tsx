import { API_BASE_URL } from "@project-gestion/config";
import { buildCalendarFeedUrl, toWebcalUrl } from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import type { CalendarSubscription, Project } from "@project-gestion/types";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { CalendarPlus, Copy, Share2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { TogglePill } from "../../../components/filters/TogglePill";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { Button } from "../../../components/ui/Button";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import {
  useCalendarSubscription,
  useRevokeCalendarSubscription,
  useSaveCalendarSubscription,
} from "../hooks/use-calendar-subscription";

export function CalendarScreen() {
  return (
    <ProjectSectionScreen
      title="Calendrier"
      requiredPermission={(can) => can(permissionCodes.taskView) || can(permissionCodes.timeEntryView)}
    >
      {(project) => <CalendarSubscriptionView project={project} />}
    </ProjectSectionScreen>
  );
}

/** Pas de vue calendrier sur mobile : le telephone en a deja une. L'ecran sert a
 * brancher le projet sur l'application Calendrier du systeme, via le meme flux iCal
 * que le web.
 *
 * L'abonnement est charge ici, puis le formulaire est remonte (via `key`) quand son
 * identite change, plutot que synchronise dans un effet : les interrupteurs n'ont
 * besoin que d'une valeur initiale correcte. */
function CalendarSubscriptionView({ project }: { project: Project }) {
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewTime = can(permissionCodes.timeEntryView);

  const subscriptionQuery = useCalendarSubscription(project.id);
  const subscription = subscriptionQuery.data ?? null;

  if (subscriptionQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <CalendarSubscriptionForm
      key={subscription?.id ?? "new"}
      project={project}
      subscription={subscription}
      canViewTasks={canViewTasks}
      canViewTime={canViewTime}
      loadError={subscriptionQuery.isError ? subscriptionQuery.error : null}
      onRetry={() => subscriptionQuery.refetch()}
    />
  );
}

function CalendarSubscriptionForm({
  project,
  subscription,
  canViewTasks,
  canViewTime,
  loadError,
  onRetry,
}: {
  project: Project;
  subscription: CalendarSubscription | null;
  canViewTasks: boolean;
  canViewTime: boolean;
  loadError: unknown;
  onRetry: () => void;
}) {
  const saveSubscription = useSaveCalendarSubscription(project.id);
  const revokeSubscription = useRevokeCalendarSubscription(project.id);

  const [includeTasks, setIncludeTasks] = useState(subscription?.include_tasks ?? canViewTasks);
  const [includeTime, setIncludeTime] = useState(subscription?.include_time ?? canViewTime);
  const [copied, setCopied] = useState(false);

  const feedUrl = subscription ? buildCalendarFeedUrl(API_BASE_URL, subscription.token) : null;
  const isDirty = subscription
    ? subscription.include_tasks !== includeTasks || subscription.include_time !== includeTime
    : true;

  async function subscribeOnDevice() {
    if (!feedUrl) {
      return;
    }
    const webcalUrl = toWebcalUrl(feedUrl);
    // iOS ouvre l'app Calendrier sur la proposition d'abonnement ; les Android qui
    // ne connaissent pas `webcal://` retombent sur le partage du lien.
    const canOpen = await Linking.canOpenURL(webcalUrl);
    if (canOpen) {
      await Linking.openURL(webcalUrl);
      return;
    }
    await shareLink();
  }

  async function shareLink() {
    if (!feedUrl) {
      return;
    }
    await Share.share({
      message: feedUrl,
      title: `Calendrier ${project.name}`,
    });
  }

  async function copyLink() {
    if (!feedUrl) {
      return;
    }
    await Clipboard.setStringAsync(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function confirmRevoke() {
    Alert.alert(
      "Revoquer l'abonnement ?",
      "Le lien deja ajoute dans les applications de calendrier cessera de fonctionner.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Revoquer", style: "destructive", onPress: () => revokeSubscription.mutate() },
      ],
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View className="gap-1">
        <Text className="text-lg font-semibold text-foreground">Lier ce projet a ton calendrier</Text>
        <Text className="text-sm text-muted">
          Genere un lien d&apos;abonnement a ajouter dans l&apos;application Calendrier du telephone,
          Google Calendar ou Outlook. Les echeances et les heures du projet y apparaissent
          automatiquement.
        </Text>
      </View>

      <InlineMessage variant="danger">
        {getErrorMessage(saveSubscription.error) ?? getErrorMessage(revokeSubscription.error)}
      </InlineMessage>

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Contenu du calendrier</Text>
        <View className="flex-row flex-wrap gap-2">
          {canViewTasks ? (
            <TogglePill
              label="Inclure les taches"
              active={includeTasks}
              onPress={() => setIncludeTasks((value) => !value)}
            />
          ) : null}
          {canViewTime ? (
            <TogglePill
              label="Inclure le temps"
              active={includeTime}
              onPress={() => setIncludeTime((value) => !value)}
            />
          ) : null}
        </View>
      </View>

      <Button
        onPress={() =>
          saveSubscription.mutate({ include_tasks: includeTasks, include_time: includeTime })
        }
        disabled={(!includeTasks && !includeTime) || !isDirty || saveSubscription.isPending}
      >
        {saveSubscription.isPending
          ? "Enregistrement..."
          : subscription
            ? "Mettre a jour le lien"
            : "Generer le lien"}
      </Button>

      {feedUrl ? (
        <View className="gap-3 rounded-md border border-border bg-surface p-4">
          <Text className="text-sm font-medium text-foreground">Lien d&apos;abonnement</Text>
          <Text className="text-xs text-muted" numberOfLines={3}>
            {feedUrl}
          </Text>

          <Pressable
            onPress={subscribeOnDevice}
            accessibilityRole="button"
            android_ripple={{ color: `${theme.colors.primaryForeground}33` }}
            className="h-11 flex-row items-center justify-center gap-2 rounded-md bg-primary"
          >
            <CalendarPlus size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
            <Text className="text-sm font-semibold text-primaryForeground">
              Ajouter a mon calendrier
            </Text>
          </Pressable>

          <View className="flex-row gap-2">
            <Pressable
              onPress={shareLink}
              accessibilityRole="button"
              className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border"
            >
              <Share2 size={theme.iconSize.sm} color={theme.colors.foreground} />
              <Text className="text-sm font-medium text-foreground">Partager</Text>
            </Pressable>
            <Pressable
              onPress={copyLink}
              accessibilityRole="button"
              className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border"
            >
              <Copy size={theme.iconSize.sm} color={theme.colors.foreground} />
              <Text className="text-sm font-medium text-foreground">{copied ? "Copie" : "Copier"}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={confirmRevoke}
            disabled={revokeSubscription.isPending}
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-md border border-danger/30 bg-danger/10"
          >
            <Text className="text-sm font-medium text-danger">
              {revokeSubscription.isPending ? "Revocation..." : "Revoquer le lien"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loadError ? <ErrorState message={getErrorMessage(loadError)} onRetry={onRetry} /> : null}
    </ScrollView>
  );
}
