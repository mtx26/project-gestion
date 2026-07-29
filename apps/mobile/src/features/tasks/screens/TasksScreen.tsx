import { permissionCodes } from "@project-gestion/permissions";
import type { Project, Task } from "@project-gestion/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDown, ArrowUp, ListChecks, Plus, Search, UserCheck } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { TaskPriorityBadge } from "../../../components/badges/TaskPriorityBadge";
import { TaskStatusBadge } from "../../../components/badges/TaskStatusBadge";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FilterPill } from "../../../components/filters/FilterPill";
import { FilterTrigger } from "../../../components/filters/FilterTrigger";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { Input } from "../../../components/ui/Input";
import { showActionSheet } from "../../../lib/action-sheet";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { findFolderName } from "../../../lib/folder-tree";
import { buildMemberFilterOptions } from "../../../lib/member-options";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useProjectFolders, useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { TaskFilterSheet } from "../components/TaskFilterSheet";
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
  const { folders } = useProjectFolders(project.id);

  // Status/priority live directly off the route params (same convention as
  // web reading straight from useSearchParams) so a link like the Dashboard's
  // "Taches urgentes" tile (?priority=high) just works, and the filter stays
  // whatever it was last set to across visits — no separate local copy to
  // keep in sync or clear.
  const params = useLocalSearchParams<{ priority?: string; status?: string }>();
  const statusFilter: StatusFilter = (params.status as StatusFilter) ?? "all";
  const priorityFilter: PriorityFilter = (params.priority as PriorityFilter) ?? "all";

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [createdBy, setCreatedBy] = useState<number | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Same idea as web's FilterToggle: the "include completed" chip reads as
  // checked whenever status is pinned to "done", even though that's not
  // stored as its own flag — only the raw toggle drives the actual query
  // when status isn't "done" (see includeCompleted usage below).
  const includeCompletedDisplay = includeCompleted || statusFilter === "done";

  const activeFilters = [
    Boolean(search),
    statusFilter !== "all",
    priorityFilter !== "all",
    assignedTo != null,
    createdBy != null,
    folderId != null,
    Boolean(dateFrom),
    Boolean(dateTo),
    includeCompleted,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setAssignedTo(null);
    setCreatedBy(null);
    setFolderId(null);
    setDateFrom(undefined);
    setDateTo(undefined);
    setIncludeCompleted(false);
    setSortField("");
    setSortDir("asc");
    router.setParams({ priority: undefined, status: undefined });
  }

  const ordering = sortField ? `${sortDir === "desc" ? "-" : ""}${sortField}` : undefined;

  const myTasks = useTasks(project.id, {
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    assignedTo: user?.id,
    folderId: folderId ?? undefined,
    dateFrom,
    dateTo,
    includeCompleted,
  });
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
    count,
  } = useTasksInfinite(project.id, {
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    assignedTo: assignedTo ?? undefined,
    createdBy: createdBy ?? undefined,
    folderId: folderId ?? undefined,
    dateFrom,
    dateTo,
    includeCompleted,
    ordering,
  });

  function pickStatus() {
    showActionSheet("Statut", STATUS_OPTIONS, (value) =>
      router.setParams({ status: value === "all" ? undefined : value }),
    );
  }

  function pickPriority() {
    showActionSheet("Priorite", PRIORITY_OPTIONS, (value) =>
      router.setParams({ priority: value === "all" ? undefined : value }),
    );
  }

  function pickAssignee() {
    showActionSheet("Assigne a", buildMemberFilterOptions(members, user?.id ?? null), (value) =>
      setAssignedTo(value === "all" ? null : Number(value)),
    );
  }

  function pickCreatedBy() {
    showActionSheet("Cree par", buildMemberFilterOptions(members, user?.id ?? null), (value) =>
      setCreatedBy(value === "all" ? null : Number(value)),
    );
  }

  function pickSort() {
    showActionSheet("Trier par", SORT_OPTIONS, (value) => setSortField(value as SortField));
  }

  function handleRefresh() {
    resetFilters();
    refetch();
  }

  const assigneeLabel =
    assignedTo == null
      ? "Tous"
      : assignedTo === user?.id
        ? "Moi"
        : (members.find((member) => member.user === assignedTo)?.user_display_name ?? "Assigne");
  const createdByLabel =
    createdBy == null
      ? "Tous"
      : createdBy === user?.id
        ? "Moi"
        : (members.find((member) => member.user === createdBy)?.user_display_name ?? "Assigne");
  const folderLabel = folderId == null ? "Tous" : (findFolderName(folders, folderId) ?? "Dossier");
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "";
  const priorityLabel = PRIORITY_OPTIONS.find((option) => option.value === priorityFilter)?.label ?? "";
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
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={handleRefresh} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <View className="flex-row items-center gap-2">
              <View className="h-11 flex-1 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3">
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
              <FilterTrigger activeCount={activeFilters} onPress={() => setFilterSheetOpen(true)} />
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
              <View className="gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                <View className="flex-row items-center gap-2">
                  <UserCheck size={theme.iconSize.sm} color={theme.colors.primary} />
                  <Text className="text-sm font-semibold text-primary">Mes taches assignees ({myTasks.count})</Text>
                </View>
                <View className="gap-3">
                  {myTasks.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: String(task.id) } })}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}

            {myTasks.tasks.length > 0 && tasks.length > 0 ? (
              <View className="flex-row items-center gap-2 pt-2">
                <ListChecks size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="text-sm font-semibold text-foreground">Toutes les taches ({count})</Text>
              </View>
            ) : null}
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
          <TaskCard task={item} onPress={() => router.push({ pathname: "/tasks/[id]", params: { id: String(item.id) } })} />
        )}
      />

      <FolderPickerModal
        visible={folderPickerOpen}
        folders={folders}
        selectedFolderId={folderId}
        onSelect={(id) => setFolderId(id)}
        onClose={() => setFolderPickerOpen(false)}
      />

      <TaskFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        statusLabel={statusLabel}
        onPickStatus={pickStatus}
        priorityLabel={priorityLabel}
        onPickPriority={pickPriority}
        assigneeLabel={assigneeLabel}
        onPickAssignee={pickAssignee}
        createdByLabel={createdByLabel}
        onPickCreatedBy={pickCreatedBy}
        folderLabel={folderLabel}
        onPickFolder={() => setFolderPickerOpen(true)}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        includeCompletedDisplay={includeCompletedDisplay}
        onToggleIncludeCompleted={() => setIncludeCompleted((value) => !value)}
        onReset={resetFilters}
      />
    </View>
  );
}

function TaskCard({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className="gap-2 rounded-md border border-border bg-surface p-4"
    >
      <Text className="text-base font-semibold text-foreground">{task.title}</Text>
      <View className="flex-row flex-wrap gap-2">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
      </View>
      {task.end_date ? <Text className="text-xs text-muted">Echeance : {formatDate(task.end_date)}</Text> : null}
      {task.assigned_to_display_names.length > 0 ? (
        <Text className="text-xs text-muted" numberOfLines={1}>
          {task.assigned_to_display_names.join(", ")}
        </Text>
      ) : null}
    </Pressable>
  );
}
