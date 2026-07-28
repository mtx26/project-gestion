import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useProjects } from "../hooks/use-projects";

export function ProjectsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { projects, isLoading, isFetching, isError, error, refetch } = useProjects();

  async function onLogout() {
    await logout();
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 px-5 py-6">
        <View className="mb-5 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-primary">Project Gestion</Text>
            <Text className="mt-2 text-2xl font-semibold text-foreground">Projets</Text>
            <Text className="mt-1 text-sm text-muted">
              {user ? `${user.first_name || user.username}, voici tes projets.` : "Session active"}
            </Text>
          </View>
          <Button variant="secondary" onPress={onLogout}>
            Deconnexion
          </Button>
        </View>

        <Button onPress={() => router.push("/projects/create")}>Nouveau projet</Button>

        <View className="mt-4 flex-1">
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
          ) : (
            <FlatList<Project>
              data={projects}
              keyExtractor={(item) => String(item.id)}
              refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
              contentContainerStyle={projects.length === 0 ? { flexGrow: 1 } : undefined}
              ListEmptyComponent={
                <EmptyState
                  title="Aucun projet pour le moment"
                  description="Cree ton premier projet pour commencer."
                />
              }
              ItemSeparatorComponent={() => <View className="h-3" />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push({ pathname: "/projects/[id]", params: { id: String(item.id) } })}
                  accessibilityRole="button"
                  android_ripple={{ color: `${theme.colors.foreground}1f` }}
                  className="gap-2 rounded-md border border-border bg-surface p-4"
                >
                  <Text className="text-base font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-sm leading-5 text-muted">
                    {item.description || "Sans description"}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
