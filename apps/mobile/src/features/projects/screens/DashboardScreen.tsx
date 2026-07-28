import { permissionCodes } from "@project-gestion/permissions";
import { useRouter } from "expo-router";
import { Banknote, CheckCircle2, Clock3, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MemberAvatar } from "../../../components/ui/MemberAvatar";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { NoProjectState } from "../../../components/feedback/NoProjectState";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useTasks } from "../../tasks/hooks/use-tasks";
import { useProjectPermissions } from "../hooks/use-project-permissions";
import { useProjectMembers } from "../hooks/use-project-resources";
import { useSelectedProject } from "../hooks/use-selected-project";

export function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading, isError, error, refetch } = useSelectedProject();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewMembers = can(permissionCodes.memberView);

  const projectId = selectedProject?.id ?? null;
  const urgentTasksQuery = useTasks(canViewTasks ? projectId : null, { priority: "high" });
  const urgentTasks = urgentTasksQuery.tasks.filter((task) => task.status !== "done");
  const membersQuery = useProjectMembers(canViewMembers ? projectId : null);

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
              {canViewTasks ? (
                <SummaryTile
                  icon={CheckCircle2}
                  label="Taches urgentes"
                  value={urgentTasksQuery.isLoading ? "..." : String(urgentTasks.length)}
                  detail={urgentTasks.length === 0 ? "Aucune urgence." : "Priorite haute, non terminees."}
                  onPress={() => router.push({ pathname: "/tasks", params: { priority: "high" } })}
                />
              ) : null}
              {can(permissionCodes.timeEntryView) ? (
                <SummaryTile icon={Clock3} label="Temps" value="-" detail="A venir" onPress={() => router.push("/time")} />
              ) : null}
              {can(permissionCodes.financeView) ? (
                <SummaryTile
                  icon={Banknote}
                  label="Finances"
                  value="-"
                  detail="A venir"
                  onPress={() => router.push("/finance")}
                />
              ) : null}
            </View>

            {canViewMembers ? (
              <View className="rounded-md border border-border bg-surface p-4">
                <View className="flex-row items-center gap-2">
                  <Users size={theme.iconSize.sm} color={theme.colors.primary} />
                  <Text className="text-sm font-semibold text-foreground">Membres du projet</Text>
                </View>
                <Text className="mt-1 text-xs text-muted">
                  {membersQuery.isLoading ? "Chargement..." : `${membersQuery.members.length} membre(s)`}
                </Text>
                <View className="mt-3 gap-2">
                  {membersQuery.members.map((member) => (
                    <View key={member.id} className="flex-row items-center gap-2.5">
                      <MemberAvatar name={member.user_display_name} pictureUrl={member.user_picture_url} />
                      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                        {member.user_display_name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <EmptyState
              title="Vue d'ensemble a venir"
              description="Les statistiques temps et finances arriveront ici une fois ces fonctionnalites migrees."
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
  value,
  detail,
  onPress,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-w-[140px] flex-1 gap-2 rounded-md border border-border bg-surface p-4"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-muted">{label}</Text>
        <Icon size={theme.iconSize.sm} color={theme.colors.primary} />
      </View>
      <Text className="text-xl font-semibold text-foreground">{value}</Text>
      <Text className="text-xs leading-5 text-muted">{detail}</Text>
    </Pressable>
  );
}
