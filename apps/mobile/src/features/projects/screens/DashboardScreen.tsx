import { permissionCodes } from "@project-gestion/permissions";
import { useRouter } from "expo-router";
import { Banknote, CheckCircle2, Clock3 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { NoProjectState } from "../../../components/feedback/NoProjectState";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useProjectPermissions } from "../hooks/use-project-permissions";
import { useSelectedProject } from "../hooks/use-selected-project";

export function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading, isError, error, refetch } = useSelectedProject();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5 py-6">
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 px-5 py-6">
        <Text className="text-sm font-semibold text-primary">Project Gestion</Text>
        <Text className="mt-2 text-2xl font-semibold text-foreground">Dashboard</Text>

        {!selectedProject ? (
          <View className="mt-6">
            <NoProjectState
              description="Cree ton premier projet pour commencer."
              onCreateProject={() => router.push("/projects/create")}
            />
          </View>
        ) : (
          <View className="mt-6 gap-3">
            <View className="rounded-md border border-border bg-surface p-4">
              <Text className="text-xs font-medium uppercase text-primary">Projet actif</Text>
              <Text className="mt-2 text-xl font-semibold text-foreground">{selectedProject.name}</Text>
              <Text className="mt-2 text-sm leading-5 text-muted">
                {selectedProject.description || "Aucune description pour ce projet."}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              {can(permissionCodes.taskView) ? (
                <SummaryTile
                  icon={CheckCircle2}
                  label="Taches"
                  onPress={() => router.push("/tasks")}
                />
              ) : null}
              {can(permissionCodes.timeEntryView) ? (
                <SummaryTile
                  icon={Clock3}
                  label="Temps"
                  onPress={() => router.push("/time")}
                />
              ) : null}
              {can(permissionCodes.financeView) ? (
                <SummaryTile
                  icon={Banknote}
                  label="Finances"
                  onPress={() => router.push("/finance")}
                />
              ) : null}
            </View>

            <EmptyState
              title="Vue d'ensemble a venir"
              description="Les statistiques du projet (taches, temps, finances) arriveront ici au fur et a mesure de la migration."
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-w-[100px] flex-1 gap-2 rounded-md border border-border bg-surface p-4"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
    >
      <Icon size={theme.iconSize.md} color={theme.colors.primary} />
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}
