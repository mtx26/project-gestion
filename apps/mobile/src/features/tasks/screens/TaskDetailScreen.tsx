import { permissionCodes } from "@project-gestion/permissions";
import type { Task } from "@project-gestion/types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CalendarClock,
  CircleCheck,
  Clock,
  Folder,
  Pencil,
  Trash2,
  UserRound,
  Users,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TaskPriorityBadge } from "../../../components/badges/TaskPriorityBadge";
import { TaskStatusBadge } from "../../../components/badges/TaskStatusBadge";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { showActionSheet } from "../../../lib/action-sheet";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { theme } from "../../../theme";
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

  const folderName = !task ? null : task.folder == null ? null : (task.folder_name ?? `Dossier #${task.folder}`);
  const assigneeNames = task?.assigned_to_display_names ?? [];

  return (
    // No "top" edge: the native header (back button + title + "Modifier") already
    // sits above this screen and accounts for the status bar.
    <SafeAreaView className="flex-1 bg-background" edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: task?.title ?? "Tache",
          // headerRight is always the same function (never undefined) so the
          // native header never has to remeasure between "no button" and
          // "button" while canEdit/canDelete resolve — that swap was what
          // made the icon look off-center on some loads.
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
                    task && router.push({ pathname: "/tasks/[id]/edit", params: { id: String(task.id) } })
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
      ) : isError || !task ? (
        <View className="px-5 py-6">
          <ErrorState
            message={task ? "Tache introuvable." : getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            <Pressable onPress={canEdit ? changeStatus : undefined} disabled={!canEdit}>
              <TaskStatusBadge status={task.status} />
            </Pressable>
            <TaskPriorityBadge priority={task.priority} />
          </View>

          <View className="gap-3 rounded-md border border-border bg-surface p-4">
            {folderName ? <DetailRow icon={Folder} label="Dossier" value={folderName} /> : null}
            {task.start_date ? (
              <DetailRow icon={CalendarClock} label="Date de debut" value={formatDate(task.start_date)} />
            ) : null}
            {task.end_date ? (
              <DetailRow icon={Calendar} label="Date de fin" value={formatDate(task.end_date)} />
            ) : null}
            {assigneeNames.length > 0 ? (
              <DetailRow icon={Users} label="Assignes" value={assigneeNames.join(", ")} />
            ) : null}
            <DetailRow icon={UserRound} label="Cree par" value={task.created_by_name ?? "-"} />
            <DetailRow icon={Clock} label="Cree le" value={formatDate(task.created_at)} />
            {task.completed_at ? (
              <DetailRow icon={CircleCheck} label="Terminee le" value={formatDate(task.completed_at)} />
            ) : null}
          </View>

          {task.description ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Description</Text>
              <Text className="text-sm leading-relaxed text-muted">{task.description}</Text>
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
