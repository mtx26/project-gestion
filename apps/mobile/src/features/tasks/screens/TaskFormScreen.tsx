import { zodResolver } from "@hookform/resolvers/zod";
import type { Task } from "@project-gestion/types";
import { taskSchema, type TaskFormInput, type TaskFormValues } from "@project-gestion/validation";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { Calendar } from "lucide-react-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { MemberMultiSelectModal } from "../../../components/pickers/MemberMultiSelectModal";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Screen } from "../../../components/ui/Screen";
import { showActionSheet } from "../../../lib/action-sheet";
import { formatDateTime } from "../../../lib/date-format";
import { findFolderName } from "../../../lib/folder-tree";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { theme } from "../../../theme";
import { useProjectFolders, useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { encodeFolderValue, getFolderId } from "../lib/task-filters";
import { useCreateTask, useTask, useUpdateTask } from "../hooks/use-tasks";

const STATUS_OPTIONS: { label: string; value: Task["status"] }[] = [
  { label: "A faire", value: "todo" },
  { label: "En cours", value: "in_progress" },
  { label: "Termine", value: "done" },
];
const PRIORITY_OPTIONS: { label: string; value: Task["priority"] }[] = [
  { label: "Basse", value: "low" },
  { label: "Normale", value: "normal" },
  { label: "Haute", value: "high" },
];

interface TaskFormScreenProps {
  mode: "create" | "edit";
  taskId?: number;
}

export function TaskFormScreen({ mode, taskId }: TaskFormScreenProps) {
  const { selectedProject } = useSelectedProject();
  const projectId = selectedProject?.id ?? null;
  const taskQuery = useTask(projectId, mode === "edit" ? (taskId ?? null) : null);

  if (mode === "edit" && (taskQuery.isLoading || !taskQuery.data)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <TaskFormBody mode={mode} projectId={projectId} task={mode === "edit" ? (taskQuery.data ?? null) : null} />
  );
}

function TaskFormBody({
  mode,
  projectId,
  task,
}: {
  mode: "create" | "edit";
  projectId: number | null;
  task: Task | null;
}) {
  const router = useRouter();
  const [rawError, setRawError] = useState<unknown>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const { folders } = useProjectFolders(projectId);
  const { members } = useProjectMembers(projectId);

  const form = useForm<TaskFormInput, any, TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      folder: encodeFolderValue(task?.folder ?? null),
      status: task?.status ?? "todo",
      priority: task?.priority ?? "normal",
      startDate: task?.start_date ?? "",
      endDate: task?.end_date ?? "",
      assignees: task?.assigned_to ?? [],
    },
  });

  useServerFieldErrors(form, rawError, [
    "title",
    "priority",
    { name: "folder", serverField: "folder" },
    { name: "startDate", serverField: "start_date" },
    { name: "endDate", serverField: "end_date" },
    { name: "assignees", serverField: "assigned_to" },
  ]);

  function pickStatus() {
    showActionSheet("Statut", STATUS_OPTIONS, (value) => form.setValue("status", value as Task["status"]));
  }

  function pickPriority() {
    showActionSheet("Priorite", PRIORITY_OPTIONS, (value) =>
      form.setValue("priority", value as Task["priority"]),
    );
  }

  async function onSubmit(values: TaskFormValues) {
    setRawError(null);
    try {
      const folder = getFolderId(values.folder);
      if (mode === "create") {
        await createTask.mutateAsync({
          title: values.title,
          description: values.description,
          folder,
          status: values.status,
          priority: values.priority,
          start_date: values.startDate,
          end_date: values.endDate,
          assigned_to: values.assignees,
        });
      } else if (task) {
        await updateTask.mutateAsync({
          taskId: task.id,
          payload: {
            title: values.title,
            description: values.description,
            folder,
            status: values.status,
            priority: values.priority,
            start_date: values.startDate,
            end_date: values.endDate,
            assigned_to: values.assignees,
          },
        });
      }
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  const isSubmitting = createTask.isPending || updateTask.isPending;

  return (
    <Screen
      title={mode === "create" ? "Nouvelle tache" : "Modifier la tache"}
      subtitle={
        mode === "create"
          ? "Ajoute une tache a ce projet."
          : "Modifie le titre, le statut et les informations de suivi."
      }
    >
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <FormField
            label="Titre"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

      {mode === "edit" ? (
        <PickerField
          label="Statut"
          value={STATUS_OPTIONS.find((option) => option.value === form.watch("status"))?.label ?? ""}
          onPress={pickStatus}
        />
      ) : null}

      <PickerField
        label="Priorite"
        value={PRIORITY_OPTIONS.find((option) => option.value === form.watch("priority"))?.label ?? ""}
        onPress={pickPriority}
      />

      <Controller
        control={form.control}
        name="folder"
        render={({ field }) => {
          const folderId = getFolderId(field.value);
          return (
            <>
              <PickerField
                label="Dossier"
                value={folderId == null ? "Projet (racine)" : (findFolderName(folders, folderId) ?? "Dossier")}
                onPress={() => setFolderPickerOpen(true)}
              />
              <FolderPickerModal
                visible={folderPickerOpen}
                folders={folders}
                selectedFolderId={folderId}
                onSelect={(id) => field.onChange(encodeFolderValue(id))}
                onClose={() => setFolderPickerOpen(false)}
              />
            </>
          );
        }}
      />

      <Controller
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <DateField label="Debut" value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="endDate"
        render={({ field, fieldState }) => (
          <View className="gap-1">
            <DateField label="Echeance" value={field.value} onChange={field.onChange} />
            {fieldState.error ? (
              <Text className="text-sm text-danger">{fieldState.error.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="assignees"
        render={({ field }) => {
          const names = members
            .filter((member) => field.value.includes(member.user))
            .map((member) => member.user_display_name);
          return (
            <>
              <PickerField
                label="Assignes"
                value={names.length > 0 ? names.join(", ") : "Personne"}
                onPress={() => setMemberPickerOpen(true)}
              />
              <MemberMultiSelectModal
                visible={memberPickerOpen}
                members={members}
                selectedIds={field.value}
                onChange={field.onChange}
                onClose={() => setMemberPickerOpen(false)}
              />
            </>
          );
        }}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        )}
      />

      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
        {mode === "create" ? "Creer" : "Enregistrer"}
      </Button>
      <Button variant="ghost" onPress={() => router.back()}>
        Annuler
      </Button>
    </Screen>
  );
}

function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="h-11 min-h-[44px] justify-center rounded-md border border-border bg-surface px-3"
      >
        <Text className="text-base text-foreground">{value}</Text>
      </Pressable>
    </View>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(value) : new Date();

  function handleChange(event: { type: string }, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (event.type === "set" && selectedDate) {
      onChange(selectedDate.toISOString());
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      {Platform.OS === "ios" ? (
        <View className="flex-row items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
          <Text className="text-base text-foreground">{value ? formatDateTime(value) : "Non definie"}</Text>
          <DateTimePicker value={dateValue} mode="datetime" display="compact" onChange={handleChange} />
        </View>
      ) : (
        <Pressable
          onPress={() => setShow(true)}
          accessibilityRole="button"
          className="h-11 min-h-[44px] flex-row items-center justify-between rounded-md border border-border bg-surface px-3"
        >
          <Text className="text-base text-foreground">{value ? formatDateTime(value) : "Non definie"}</Text>
          <Calendar size={theme.iconSize.sm} color={theme.colors.muted} />
        </Pressable>
      )}
      {value ? (
        <Pressable onPress={() => onChange("")} accessibilityRole="button">
          <Text className="text-xs text-danger">Effacer la date</Text>
        </Pressable>
      ) : null}
      {show && Platform.OS === "android" ? (
        <DateTimePicker value={dateValue} mode="datetime" display="default" onChange={handleChange} />
      ) : null}
    </View>
  );
}
