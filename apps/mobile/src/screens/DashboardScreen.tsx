import { queryKeys } from "@project-gestion/query-keys";
import type { Project } from "@project-gestion/types";
import { projectSchema, type ProjectFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { FlatList, Text, View } from "react-native";
import { Button, Field, Message } from "../components/ui";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { useAuthStore } from "../stores/auth-store";

function normalizeProjects(data: Project[] | { results: Project[] } | undefined) {
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : data.results;
}

export function DashboardScreen() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: api.projects.list,
  });
  const createProject = useMutation({
    mutationFn: api.projects.create,
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
  const deleteProject = useMutation({
    mutationFn: api.projects.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const projects = normalizeProjects(projectsQuery.data);

  function onSubmit(values: ProjectFormValues) {
    createProject.mutate({
      name: values.name,
      description: values.description?.trim() || null,
    });
  }

  async function onLogout() {
    await logout();
    queryClient.clear();
  }

  return (
    <View className="flex-1 bg-background px-5 py-10">
      <View className="mb-5 flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-primary">Project Gestion</Text>
          <Text className="mt-2 text-2xl font-semibold text-foreground">Dashboard</Text>
          <Text className="mt-1 text-sm text-muted">
            {user ? `${user.first_name || user.username}, voici tes projets.` : "Session active"}
          </Text>
        </View>
        <Button variant="secondary" onPress={onLogout}>
          Logout
        </Button>
      </View>

      <View className="mb-5 gap-3 rounded-md border border-border bg-surface p-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field label="Nom du projet" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <Field label="Description" value={field.value} onChangeText={field.onChange} autoCapitalize="sentences" />
          )}
        />
        <Message danger>{createProject.error ? getErrorMessage(createProject.error) : null}</Message>
        <Button onPress={form.handleSubmit(onSubmit)} disabled={createProject.isPending}>
          Creer
        </Button>
      </View>

      <Message danger>{projectsQuery.error ? getErrorMessage(projectsQuery.error) : null}</Message>
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
            {projectsQuery.isLoading ? "Chargement des projets..." : "Aucun projet pour le moment."}
          </Text>
        }
        renderItem={({ item }) => (
          <View className="mb-3 gap-3 rounded-md border border-border bg-surface p-4">
            <View>
              <Text className="text-base font-semibold text-foreground">{item.name}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{item.description || "Sans description"}</Text>
            </View>
            <Button variant="danger" onPress={() => deleteProject.mutate(item.id)} disabled={deleteProject.isPending}>
              Supprimer
            </Button>
          </View>
        )}
      />
    </View>
  );
}

