import { permissionCodes } from "@project-gestion/permissions";
import type { Project, Task } from "@project-gestion/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Search, UserCheck } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { TaskPriorityBadge } from "../../../components/badges/TaskPriorityBadge";
import { TaskStatusBadge } from "../../../components/badges/TaskStatusBadge";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { Input } from "../../../components/ui/Input";
import { showActionSheet } from "../../../lib/action-sheet";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { useTasks, useTasksInfinite } from "../hooks/use-tasks";

type StatusFilter = "all" | Task["status"];
type PriorityFilter = "all" | Task["priority"];
type SortField = "" | "title" | "priority_order" | "end_date";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Tous statuts", value: "all" },
  { label: "A faire", value: "todo" },
  { label: "En cours", value: "in_progress" },
  { label: "Termine", value: "done" },
];
const PRIORITY_OPTIONS: { label: string; value: PriorityFilter }[] = [
  { label: "Toutes priorites", value: "all" },
  { label: "Basse", value: "low" },
  { label: "Normale", value: "normal" },
  { label: "Haute", value: "high" },
];
const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Ordre par defaut", value: "" },
  { label: "Titre", value: "title" },
  { label: "Priorite", value: "priority_order" },
  { label: "Echeance", value: "end_date" },
];

export function TasksScreen() {
  return (
    <ProjectSectionScreen title="Taches" requiredPermission={permissionCodes.taskView}>
      {(project) => <TasksListView project={project} />}
    </ProjectSectionScreen>
  );
}

function TasksListView({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canEdit = can(permissionCodes.taskEdit);
  const { members } = useProjectMembers(project.id);
  const params = useLocalSearchParams<{ priority?: string; status?: string }>();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (params.status as StatusFilter) ?? "all",
  );
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    (params.priority as PriorityFilter) ?? "all",
  );
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const ordering = sortField ? `${sortDir === "desc" ? "-" : ""}${sortField}` : undefined;

  const myTasks = useTasks(project.id, { assignedTo: user?.id, status: undefined });
  const {
    tasks,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useTasksInfinite(project.id, {
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    assignedTo: assignedTo ?? undefined,
    ordering,
  });

  function pickStatus() {
    showActionSheet("Statut", STATUS_OPTIONS, (value) => setStatusFilter(value as StatusFilter));
  }

  function pickPriority() {
    showActionSheet("Priorite", PRIORITY_OPTIONS, (value) => setPriorityFilter(value as PriorityFilter));
  }

  function pickAssignee() {
    const options = [
      { label: "Tous", value: "all" },
      { label: "Moi", value: String(user?.id ?? "") },
      ...members
        .filter((member) => member.user !== user?.id)
        .map((member) => ({ label: member.user_display_name, value: String(member.user) })),
    ];
    showActionSheet("Assigne a", options, (value) => setAssignedTo(value === "all" ? null : Number(value)));
  }

  function pickSort() {
    showActionSheet("Trier par", SORT_OPTIONS, (value) => setSortField(value as SortField));
  }

  const assigneeLabel =
    assignedTo == null ? "Tous" : assignedTo === user?.id ? "Moi" : (members.find((member) => member.user === assignedTo)?.user_display_name ?? "Assigne");
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortField)?.label ?? "";

  return (
    <View className="flex-1">
      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          tasks.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20 }
            : { paddingHorizontal: 20, paddingBottom: 24 }
        }
        refreshControl={<RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={() => refetch()} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <View className="h-11 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3">
              <Search size={theme.iconSize.sm} color={theme.colors.muted} />
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher une tache"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-11 flex-1 border-0 bg-transparent px-0"
              />
            </View>

            <View className="flex-row flex-wrap items-center gap-2">
              <FilterPill
                label={STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? ""}
                onPress={pickStatus}
              />
              <FilterPill
                label={PRIORITY_OPTIONS.find((option) => option.value === priorityFilter)?.label ?? ""}
                onPress={pickPriority}
              />
              <FilterPill label={`Assigne : ${assigneeLabel}`} onPress={pickAssignee} />
            </View>

            <View className="flex-row items-center gap-2">
              <FilterPill label={`Tri : ${sortLabel}`} onPress={pickSort} />
              {sortField ? (
                <Pressable
                  onPress={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
                  accessibilityRole="button"
                  accessibilityLabel="Inverser l'ordre de tri"
                  className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
                >
                  {sortDir === "asc" ? (
                    <ArrowUp size={theme.iconSize.sm} color={theme.colors.foreground} />
                  ) : (
                    <ArrowDown size={theme.iconSize.sm} color={theme.colors.foreground} />
                  )}
                </Pressable>
              ) : null}
            </View>

            {canEdit ? (
              <Pressable
                onPress={() => router.push("/tasks/create")}
                accessibilityRole="button"
                android_ripple={{ color: `${theme.colors.primaryForeground}33` }}
                className="h-11 flex-row items-center justify-center gap-2 rounded-md bg-primary"
              >
                <Plus size={theme.iconSize.sm} color={theme.colors.primaryForeground} />
                <Text className="text-sm font-semibold text-primaryForeground">Nouvelle tache</Text>
              </Pressable>
            ) : null}

            {myTasks.tasks.length > 0 ? (
              <View className="gap-2 rounded-md border border-border bg-surface p-3">
                <View className="flex-row items-center gap-2">
                  <UserCheck size={theme.iconSize.sm} color={theme.colors.primary} />
                  <Text className="text-sm font-semibold text-foreground">Mes taches assignees</Text>
                </View>
                {myTasks.tasks.slice(0, 5).map((task) => (
                  <Pressable
                    key={task.id}
                    onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: String(task.id) } })}
                    accessibilityRole="button"
                    android_ripple={{ color: `${theme.colors.foreground}1f` }}
                    className="flex-row items-center justify-between rounded-md bg-background px-3 py-2"
                  >
                    <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                      {task.title}
                    </Text>
                    <TaskStatusBadge status={task.status} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState title="Aucune tache" description="Aucune tache ne correspond a ces filtres." />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingState /> : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: String(item.id) } })}
            accessibilityRole="button"
            android_ripple={{ color: `${theme.colors.foreground}1f` }}
            className="gap-2 rounded-md border border-border bg-surface p-4"
          >
            <Text className="text-base font-semibold text-foreground">{item.title}</Text>
            <View className="flex-row flex-wrap gap-2">
              <TaskStatusBadge status={item.status} />
              <TaskPriorityBadge priority={item.priority} />
            </View>
            {item.end_date ? (
              <Text className="text-xs text-muted">Echeance : {formatDate(item.end_date)}</Text>
            ) : null}
            {item.assigned_to_display_names.length > 0 ? (
              <Text className="text-xs text-muted" numberOfLines={1}>
                {item.assigned_to_display_names.join(", ")}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function FilterPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-9 flex-row items-center gap-1 rounded-full border border-border bg-surface px-3"
    >
      <Text className="text-xs font-medium text-foreground">{label}</Text>
      <ChevronDown size={12} color={theme.colors.muted} />
    </Pressable>
  );
}
