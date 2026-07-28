import { isProjectOwner } from "@project-gestion/permissions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { useDeleteProject, useProjects } from "../hooks/use-projects";

export function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { projects, isLoading, isError, error, refetch } = useProjects();
  const deleteProject = useDeleteProject();

  const project = projects.find((item) => String(item.id) === id);

  function confirmDelete() {
    if (!project) {
      return;
    }
    Alert.alert("Supprimer le projet", `Supprimer definitivement "${project.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteProject.mutateAsync(project.id);
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
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : !project ? (
          <EmptyState
            title="Projet introuvable"
            description="Ce projet n'existe plus ou a ete supprime."
          />
        ) : (
          <View className="gap-4">
            <View>
              <Text className="text-2xl font-semibold text-foreground">{project.name}</Text>
              <Text className="mt-2 text-sm leading-6 text-muted">
                {project.description || "Sans description"}
              </Text>
              <Text className="mt-4 text-sm text-muted">
                Proprietaire : {project.owner_display_name}
              </Text>
            </View>
            {isProjectOwner(project, user?.id) ? (
              <Button variant="danger" onPress={confirmDelete} disabled={deleteProject.isPending}>
                Supprimer le projet
              </Button>
            ) : null}
          </View>
        )}
        <Button variant="ghost" onPress={() => router.back()}>
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}
