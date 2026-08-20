import { zodResolver } from "@hookform/resolvers/zod";
import type { Task } from "@project-gestion/types";
import { taskFieldMap, taskSchema, type TaskFormInput, type TaskFormValues } from "@project-gestion/validation";
import { findFolderName } from "@project-gestion/domain";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { MemberMultiSelectModal } from "../../../components/pickers/MemberMultiSelectModal";
import { DateTimeField } from "../../../components/ui/DateTimeField";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FormScreen } from "../../../components/layout/FormScreen";
import { PickerField, SelectPickerField } from "../../../components/forms/PickerField";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
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

  useServerFieldErrors(form, rawError, taskFieldMap);

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
    <FormScreen
      title={mode === "create" ? "Nouvelle tache" : "Modifier la tache"}
      submitLabel={mode === "create" ? "Creer" : "Enregistrer"}
      submitDisabled={isSubmitting}
      onCancel={() => router.back()}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>
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
        <SelectPickerField
          label="Statut"
          value={STATUS_OPTIONS.find((option) => option.value === form.watch("status"))?.label ?? ""}
          title="Statut"
          options={STATUS_OPTIONS}
          selected={form.watch("status")}
          onSelect={(value) => form.setValue("status", value as Task["status"])}
        />
      ) : null}

      <SelectPickerField
        label="Priorite"
        value={PRIORITY_OPTIONS.find((option) => option.value === form.watch("priority"))?.label ?? ""}
        title="Priorite"
        options={PRIORITY_OPTIONS}
        selected={form.watch("priority")}
        onSelect={(value) => form.setValue("priority", value as Task["priority"])}
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
          <DateTimeField label="Debut" value={field.value} onChange={field.onChange} clearable />
        )}
      />
      <Controller
        control={form.control}
        name="endDate"
        render={({ field, fieldState }) => (
          <View className="gap-1">
            <DateTimeField label="Echeance" value={field.value} onChange={field.onChange} clearable />
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

    </FormScreen>
  );
}

