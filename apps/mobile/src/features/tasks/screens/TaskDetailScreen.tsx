import { permissionCodes } from "@project-gestion/permissions";
import type { Task } from "@project-gestion/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TaskPriorityBadge } from "../../../components/badges/TaskPriorityBadge";
import { TaskStatusBadge } from "../../../components/badges/TaskStatusBadge";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { showActionSheet } from "../../../lib/action-sheet";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useDeleteTask, useTask, useUpdateTask } from "../hooks/use-tasks";

const STATUS_CHOICES: { label: string; value: Task["status"] }[] = [
  { label: "A faire", value: "todo" },
  { label: "En cours", value: "in_progress" },
  { label: "Termine", value: "done" },
];

export function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const user = useAuthStore((state) => state.user);
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canEdit = can(permissionCodes.taskEdit);
  const canDelete = can(permissionCodes.taskDelete);

  const { data: task, isLoading, isError, error, refetch } = useTask(projectId, taskId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  function changeStatus() {
    if (!task) {
      return;
    }
    showActionSheet(
      "Changer le statut",
      STATUS_CHOICES.filter((choice) => choice.value !== task.status),
      (value) => updateTask.mutate({ taskId: task.id, payload: { status: value as Task["status"] } }),
    );
  }

  function confirmDelete() {
    if (!task) {
      return;
    }
    Alert.alert("Supprimer la tache", `Supprimer definitivement "${task.title}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteTask.mutateAsync(task.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 justify-between px-5 py-6">
        {isLoading ? (
          <LoadingState />
        ) : isError || !task ? (
          <ErrorState
            message={task ? "Tache introuvable." : getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : (
          <View className="flex-1 gap-4">
            <View className="gap-3">
              <Text className="text-2xl font-semibold text-foreground">{task.title}</Text>
              <View className="flex-row flex-wrap items-center gap-2">
                <Pressable onPress={canEdit ? changeStatus : undefined} disabled={!canEdit}>
                  <TaskStatusBadge status={task.status} />
                </Pressable>
                <TaskPriorityBadge priority={task.priority} />
              </View>
              {task.description ? (
                <Text className="text-sm leading-6 text-muted">{task.description}</Text>
              ) : null}
            </View>

            <View className="gap-2 rounded-md border border-border bg-surface p-4">
              <DetailRow label="Dossier" value={task.folder_name ?? "Projet"} />
              <DetailRow label="Debut" value={task.start_date ? formatDate(task.start_date) : "-"} />
              <DetailRow label="Echeance" value={task.end_date ? formatDate(task.end_date) : "-"} />
              <DetailRow
                label="Assignes"
                value={
                  task.assigned_to_display_names.length > 0
                    ? task.assigned_to_display_names.join(", ")
                    : "Personne"
                }
              />
              <DetailRow label="Cree par" value={task.created_by_name ?? "-"} />
            </View>

            <View className="gap-2">
              {canEdit ? (
                <Button
                  onPress={() =>
                    router.push({ pathname: "/tasks/[id]/edit", params: { id: String(task.id) } })
                  }
                >
                  Modifier
                </Button>
              ) : null}
              {canDelete ? (
                <Button variant="danger" onPress={confirmDelete} disabled={deleteTask.isPending}>
                  Supprimer
                </Button>
              ) : null}
            </View>
          </View>
        )}
        <Button variant="ghost" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="max-w-[70%] text-sm font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
