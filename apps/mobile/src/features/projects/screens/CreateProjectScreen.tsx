import { zodResolver } from "@hookform/resolvers/zod";
import {
  projectSchema,
  type ProjectFormInput,
  type ProjectFormValues,
} from "@project-gestion/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { Screen } from "../../../components/ui/Screen";
import { getErrorMessage } from "../../../lib/errors";
import { useCreateProject } from "../hooks/use-projects";

export function CreateProjectScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject();
  const form = useForm<ProjectFormInput, any, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(values: ProjectFormValues) {
    setError(null);
    try {
      await createProject.mutateAsync({
        name: values.name,
        description: values.description,
      });
      router.back();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Screen title="Nouveau projet" subtitle="Cree un projet pour commencer a organiser ton travail.">
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            label="Nom du projet"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
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
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={form.handleSubmit(onSubmit)}
          />
        )}
      />
      <InlineMessage variant="danger">{error}</InlineMessage>
      <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
        Creer
      </Button>
      <Button variant="ghost" onPress={() => router.back()}>
        Annuler
      </Button>
    </Screen>
  );
}
