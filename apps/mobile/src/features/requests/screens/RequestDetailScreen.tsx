import { permissionCodes } from "@project-gestion/permissions";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, CheckCircle2, Folder, Pencil, Trash2, UserRound, XCircle } from "lucide-react-native";
import type { ComponentType } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RequestStatusBadge } from "../../../components/badges/RequestStatusBadge";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money-format";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import {
  useApproveRequest,
  useDeleteRequest,
  useRejectRequest,
  useRequest,
} from "../hooks/use-requests";

export function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const user = useAuthStore((state) => state.user);
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canEdit = can(permissionCodes.expenseRequestEdit);
  const canDelete = can(permissionCodes.expenseRequestDelete);
  const canApprove = can(permissionCodes.expenseRequestApprove);

  const { data: request, isLoading, isError, error, refetch } = useRequest(projectId, requestId);
  const deleteRequest = useDeleteRequest(projectId);
  const approveRequest = useApproveRequest(projectId);
  const rejectRequest = useRejectRequest(projectId);

  function confirmDelete() {
    if (!request) {
      return;
    }
    Alert.alert("Supprimer la demande", `Supprimer definitivement "${request.title}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteRequest.mutateAsync(request.id);
          router.back();
        },
      },
    ]);
  }

  const isActioning = approveRequest.isPending || rejectRequest.isPending;

  return (
    // No "top" edge: the native header (back button + title + actions) already
    // sits above this screen and accounts for the status bar.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: request?.title ?? "Demande",
          // headerRight is always the same function (never undefined) so the
          // native header never has to remeasure between "no button" and
          // "button" while canEdit/canDelete resolve.
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
              {canEdit && request?.status === "pending" ? (
                <Pressable
                  onPress={() =>
                    request && router.push({ pathname: "/requests/[id]/edit", params: { id: String(request.id) } })
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
      ) : isError || !request ? (
        <View className="px-5 py-6">
          <ErrorState
            message={request ? "Demande introuvable." : getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View className="items-center gap-2 rounded-md border border-border bg-surface p-5">
            <RequestStatusBadge status={request.status} />
            <Text className="text-3xl font-bold tabular-nums text-foreground">{formatMoney(request.amount)}</Text>
          </View>

          {canApprove && request.status === "pending" ? (
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => approveRequest.mutate(request.id)}
                disabled={isActioning}
                accessibilityRole="button"
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-background"
                style={{ opacity: isActioning ? 0.5 : 1 }}
              >
                {approveRequest.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <CheckCircle2 size={theme.iconSize.sm} color={theme.colors.primary} />
                )}
                <Text className="text-sm font-medium text-foreground">
                  {approveRequest.isPending ? "Approbation..." : "Approuver"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => rejectRequest.mutate(request.id)}
                disabled={isActioning}
                accessibilityRole="button"
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-danger/30 bg-danger/10"
                style={{ opacity: isActioning ? 0.5 : 1 }}
              >
                {rejectRequest.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.danger} />
                ) : (
                  <XCircle size={theme.iconSize.sm} color={theme.colors.danger} />
                )}
                <Text className="text-sm font-medium text-danger">
                  {rejectRequest.isPending ? "Refus..." : "Refuser"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View className="gap-3 rounded-md border border-border bg-surface p-4">
            {request.category ? <DetailRow icon={Folder} label="Categorie" value={request.category} /> : null}
            {request.folder_name || request.folder ? (
              <DetailRow
                icon={Folder}
                label="Dossier"
                value={request.folder_name ?? `Dossier #${request.folder}`}
              />
            ) : null}
            {request.requested_by_name ? (
              <DetailRow icon={UserRound} label="Demande par" value={request.requested_by_name} />
            ) : null}
            <DetailRow icon={Calendar} label="Cree le" value={formatDate(request.created_at)} />
            {request.approved_at ? (
              <DetailRow icon={CheckCircle2} label="Traite le" value={formatDate(request.approved_at)} />
            ) : null}
          </View>

          {request.description ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Description</Text>
              <Text className="text-sm leading-relaxed text-muted">{request.description}</Text>
            </View>
          ) : null}
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
