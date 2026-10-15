import { zodResolver } from "@hookform/resolvers/zod";
import { canEditProject } from "@project-gestion/permissions";
import {
  projectFieldMap,
  projectSchema,
  type ProjectFormInput,
  type ProjectFormValues,
} from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FormScreen } from "../../../components/layout/FormScreen";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { useServerFieldErrors } from "../../../lib/use-server-field-errors";
import { useAuthStore } from "../../../stores/auth-store";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { useUpdateProject } from "../../projects/hooks/use-projects";

/** Nom et description du projet. En lecture seule sans `project.edit` : les champs
 * restent visibles (c'est de l'information utile) mais ne sont pas modifiables. */
export function ProjectGeneralScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading } = useSelectedProject();
  const [rawError, setRawError] = useState<unknown>(null);
  const updateProject = useUpdateProject();

  const canEdit = canEditProject(selectedProject, user?.id ?? null);

  const form = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    values: {
      name: selectedProject?.name ?? "",
      description: selectedProject?.description ?? "",
    },
  });

  useServerFieldErrors(form, rawError, projectFieldMap);

  if (isLoading || !selectedProject) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  async function onSubmit(values: ProjectFormValues) {
    if (!selectedProject || !canEdit) {
      return;
    }
    setRawError(null);
    try {
      await updateProject.mutateAsync({ id: selectedProject.id, payload: values });
      router.back();
    } catch (caught) {
      setRawError(caught);
    }
  }

  return (
    <FormScreen
      title="General"
      submitLabel="Enregistrer"
      submitDisabled={!canEdit || updateProject.isPending}
      onCancel={() => router.back()}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <InlineMessage variant="danger">{getErrorMessage(rawError)}</InlineMessage>

      {!canEdit ? (
        <InlineMessage>
          Lecture seule : il faut la permission project.edit pour modifier ces informations.
        </InlineMessage>
      ) : null}

      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            label="Nom du projet"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            editable={canEdit}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value ?? ""}
            onChangeText={field.onChange}
            placeholder="Contexte, objectif ou notes utiles"
            editable={canEdit}
            autoCapitalize="sentences"
            multiline
            numberOfLines={5}
            returnKeyType="done"
          />
        )}
      />
    </FormScreen>
  );
}
