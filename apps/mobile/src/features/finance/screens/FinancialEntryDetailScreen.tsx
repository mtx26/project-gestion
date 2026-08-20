import { FINANCIAL_SOURCE_LABELS, getEntryTarget, getEntryTargetLabel } from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Clock, Folder, ListChecks, Pencil, Tag, Trash2, UserRound } from "lucide-react-native";
import type { ComponentType } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EntryTypeBadge } from "../../../components/badges/EntryTypeBadge";
import { DocumentList } from "../../../components/documents/DocumentList";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { useOpenDocument } from "../../../lib/use-open-document";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useDeleteFinancialEntry, useFinancialEntry } from "../hooks/use-financial-entries";

export function FinancialEntryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  const user = useAuthStore((state) => state.user);
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canEdit = can(permissionCodes.financeEdit);
  const canDelete = can(permissionCodes.financeDelete);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewFiles = can(permissionCodes.fileView);

  const { data: entry, isLoading, isError, error, refetch } = useFinancialEntry(projectId, entryId);
  const deleteEntry = useDeleteFinancialEntry(projectId);
  const openDocument = useOpenDocument(projectId);

  function confirmDelete() {
    if (!entry) {
      return;
    }
    Alert.alert("Supprimer l'entree", "Supprimer definitivement cette entree financiere ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteEntry.mutateAsync(entry.id);
          router.back();
        },
      },
    ]);
  }

  const target = entry ? getEntryTarget(entry) : null;
  const TargetIcon = target?.type === "task" ? ListChecks : Folder;
  const targetPressable = target != null && (target.type === "task" ? canViewTasks : canViewFiles);

  function openTarget() {
    if (!target) {
      return;
    }
    if (target.type === "task") {
      router.push({ pathname: "/tasks/[id]", params: { id: String(target.id) } });
    } else {
      router.push("/files");
    }
  }

  return (
    // No "top" edge: the native header (back button + title + actions) already
    // sits above this screen and accounts for the status bar.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: "Detail de l'entree",
          // headerRight is always the same function (never undefined) so the native
          // header never has to remeasure between "no button" and "button" while
          // canEdit/canDelete resolve.
          headerRight: () => (
            <View className="flex-row items-center">
              {canDelete ? (
                <Pressable
                  onPress={confirmDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer"
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Trash2 size={theme.iconSize.sm} color={theme.colors.danger} />
                </Pressable>
              ) : null}
              {canEdit ? (
                <Pressable
                  onPress={() =>
                    entry && router.push({ pathname: "/finance/[id]/edit", params: { id: String(entry.id) } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Modifier"
                  hitSlop={8}
                  className="mr-1 h-11 w-11 items-center justify-center"
                >
                  <Pencil size={theme.iconSize.sm} color={theme.colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError || !entry ? (
        <View className="px-5 py-6">
          <ErrorState
            message={entry ? "Entree introuvable." : getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View className="items-center gap-2 rounded-md border border-border bg-surface p-5">
            <EntryTypeBadge type={entry.type} />
            <Text className="text-3xl font-bold tabular-nums text-foreground">
              {entry.type === "expense" ? "-" : "+"}
              {formatMoney(entry.amount)}
            </Text>
          </View>

          <View className="gap-3 rounded-md border border-border bg-surface p-4">
            <DetailRow icon={Tag} label="Origine" value={FINANCIAL_SOURCE_LABELS[entry.source]} />
            {entry.time_entry_user_name ? (
              <DetailRow icon={UserRound} label="Pour" value={entry.time_entry_user_name} />
            ) : entry.created_by_name ? (
              <DetailRow icon={UserRound} label="Cree par" value={entry.created_by_name} />
            ) : null}
            <DetailRow icon={CalendarDays} label="Date" value={formatDate(entry.date ?? entry.created_at)} />
            {target ? (
              <Pressable
                onPress={targetPressable ? openTarget : undefined}
                disabled={!targetPressable}
                accessibilityRole={targetPressable ? "button" : undefined}
                className="flex-row items-center gap-3"
              >
                <TargetIcon size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="w-28 text-sm text-muted">Cible</Text>
                <Text
                  className={`flex-1 text-sm font-medium ${targetPressable ? "text-primary" : "text-foreground"}`}
                  numberOfLines={1}
                >
                  {getEntryTargetLabel(entry)}
                </Text>
              </Pressable>
            ) : null}
            {/* Une ecriture de main d'oeuvre vient du paiement d'heures : on ouvre
                l'entree de temps payee, comme le lien du detail web. */}
            {entry.time_entry != null && canViewTime ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/time/[id]", params: { id: String(entry.time_entry) } })
                }
                accessibilityRole="button"
                className="flex-row items-center gap-3"
              >
                <Clock size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="w-28 text-sm text-muted">Entree de temps</Text>
                <Text className="flex-1 text-sm font-medium text-primary" numberOfLines={1}>
                  Voir le detail
                </Text>
              </Pressable>
            ) : null}
          </View>

          {entry.description ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Description</Text>
              <Text className="text-sm leading-relaxed text-muted">{entry.description}</Text>
            </View>
          ) : null}

          <DocumentList
            documents={entry.documents_info ?? []}
            isOpening={openDocument.isPending}
            onOpen={(documentId) => openDocument.mutate(documentId)}
          />

          {openDocument.error ? <ErrorState message={getErrorMessage(openDocument.error)} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon size={theme.iconSize.sm} color={theme.colors.muted} />
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
