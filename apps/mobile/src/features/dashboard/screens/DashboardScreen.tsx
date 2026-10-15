import { permissionCodes } from "@project-gestion/permissions";
import { useRouter } from "expo-router";
import { Banknote, CheckCircle2, Clock3, Users } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MemberAvatar } from "../../../components/ui/MemberAvatar";
import { DetailScreen } from "../../../components/layout/DetailScreen";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { NoProjectState } from "../../../components/feedback/NoProjectState";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useTasks } from "../../tasks/hooks/use-tasks";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useSelectedProject } from "../../projects/hooks/use-selected-project";
import { formatDuration } from "@project-gestion/domain";
import { formatMoney } from "../../../lib/money-format";
import { getChartRange } from "../../finance/lib/finance-filters";
import { useFinanceChart } from "../../finance/hooks/use-financial-entries";
import { useTimeEntryStats } from "../../time-entries/hooks/use-time-entries";

export function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { selectedProject, isLoading, isError, error, refetch } = useSelectedProject();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewMembers = can(permissionCodes.memberView);

  const projectId = selectedProject?.id ?? null;
  // `status: "not_done"` explicite : le compteur porte sur ce qui reste a faire. Le total
  // vient de la pagination du backend, pas de la taille de la page chargee.
  const urgentTasksQuery = useTasks(canViewTasks ? projectId : null, { priority: "high", status: "not_done" });
  const urgentTasksCount = urgentTasksQuery.count;
  const membersQuery = useProjectMembers(canViewMembers ? projectId : null);

  // Meme perimetre que les ecrans dedies, sans filtre : le tableau de bord donne
  // le total du projet, l'ecran permet ensuite de le decouper.
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewFinance = can(permissionCodes.financeView);
  const timeStatsQuery = useTimeEntryStats(canViewTime ? projectId : null, {}, canViewTime);
  const financeChartQuery = useFinanceChart(
    canViewFinance ? projectId : null,
    getChartRange(undefined, undefined),
  );
  const timeMinutes = timeStatsQuery.data?.duration_minutes ?? 0;
  const timeRemaining = Number(timeStatsQuery.data?.remaining_amount ?? 0);
  const financeBalance = Number(financeChartQuery.data?.totals.balance ?? 0);

  return (
    <DetailScreen
      isLoading={isLoading}
      error={isError ? error : undefined}
      errorMessage={getErrorMessage(error)}
      onRetry={() => refetch()}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
      >
        {!selectedProject ? (
          <NoProjectState
            description="Cree ton premier projet pour commencer."
            onCreateProject={() => router.push("/projects/create")}
          />
        ) : (
          <View className="gap-3">
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
                  value={urgentTasksQuery.isLoading ? "..." : String(urgentTasksCount)}
                  detail={urgentTasksCount === 0 ? "Aucune urgence." : "Priorite haute, non terminees."}
                  onPress={() => router.push({ pathname: "/tasks", params: { priority: "high" } })}
                />
              ) : null}
              {canViewTime ? (
                <SummaryTile
                  icon={Clock3}
                  label="Temps"
                  value={timeStatsQuery.isLoading ? "..." : formatDuration(timeMinutes)}
                  detail={
                    timeRemaining > 0 ? `${formatMoney(timeRemaining)} a payer` : "Tout est paye."
                  }
                  onPress={() => router.push("/time")}
                />
              ) : null}
              {canViewFinance ? (
                <SummaryTile
                  icon={Banknote}
                  label="Finances"
                  value={financeChartQuery.isLoading ? "..." : formatMoney(financeBalance)}
                  detail={financeBalance < 0 ? "Solde negatif." : "Solde de l'annee."}
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

          </View>
        )}
      </ScrollView>
    </DetailScreen>
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
