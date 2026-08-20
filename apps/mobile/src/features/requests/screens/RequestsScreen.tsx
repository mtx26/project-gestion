import { permissionCodes } from "@project-gestion/permissions";
import type { ExpenseRequest, Project } from "@project-gestion/types";
import { findFolderName } from "@project-gestion/domain";
import { useRouter } from "expo-router";
import { CheckCircle2, ChevronRight, Plus, Search, XCircle } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { RequestStatusBadge } from "../../../components/badges/RequestStatusBadge";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { SelectFilterPill } from "../../../components/filters/SelectFilterPill";
import { FilterTrigger } from "../../../components/filters/FilterTrigger";
import { GlassBar, GLASS_BAR_HEIGHT } from "../../../components/ui/GlassBar";
import { GlassCapsule } from "../../../components/ui/GlassCapsule";
import { GlassFab, GLASS_FAB_CLEARANCE } from "../../../components/ui/GlassFab";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { Input } from "../../../components/ui/Input";
import { formatDate } from "../../../lib/date-format";
import { getErrorMessage } from "../../../lib/errors";
import { buildMemberFilterOptions } from "../../../lib/member-options";
import { formatMoney } from "../../../lib/money-format";
import { useAuthStore } from "../../../stores/auth-store";
import { theme } from "../../../theme";
import { useProjectFolders, useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { RequestFilterSheet } from "../components/RequestFilterSheet";
import { useApproveRequest, useRejectRequest, useRequests } from "../hooks/use-requests";
import { STATUS_OPTIONS, type RequestStatusFilter } from "../lib/request-filters";
import { ThemedRefreshControl } from "../../../components/ui/ThemedRefreshControl";

type SortField = "" | "created_at" | "-amount" | "amount" | "title";

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Date recente", value: "" },
  { label: "Date ancienne", value: "created_at" },
  { label: "Montant decroissant", value: "-amount" },
  { label: "Montant croissant", value: "amount" },
  { label: "Titre A-Z", value: "title" },
];

export function RequestsScreen() {
  return (
    <ProjectSectionScreen title="Remboursements" requiredPermission={permissionCodes.expenseRequestView}>
      {(project) => <RequestsListView project={project} />}
    </ProjectSectionScreen>
  );
}

function RequestsListView({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canEdit = can(permissionCodes.expenseRequestEdit);
  const canApprove = can(permissionCodes.expenseRequestApprove);
  // `members.list` exige `member.view` cote backend.
  const { members } = useProjectMembers(can(permissionCodes.memberView) ? project.id : null);
  const { folders } = useProjectFolders(project.id);
  const approveRequest = useApproveRequest(project.id);
  const rejectRequest = useRejectRequest(project.id);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>("all");
  const [requestedBy, setRequestedBy] = useState<number | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [showRejected, setShowRejected] = useState(false);
  const [sortField, setSortField] = useState<SortField>("");

  const showRejectedDisplay = showRejected || statusFilter === "rejected";

  const activeFilters = [
    Boolean(search),
    statusFilter !== "all",
    requestedBy != null,
    folderId != null,
    Boolean(dateFrom),
    Boolean(dateTo),
    showRejected,
    Boolean(sortField),
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setRequestedBy(null);
    setFolderId(null);
    setDateFrom(undefined);
    setDateTo(undefined);
    setShowRejected(false);
    setSortField("");
  }

  const {
    requests,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    count,
  } = useRequests(project.id, {
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    requestedBy: requestedBy ?? undefined,
    folderId: folderId ?? undefined,
    excludeRejected: !showRejected && statusFilter === "all",
    ordering: sortField || undefined,
    dateFrom,
    dateTo,
  });

  function handleRefresh() {
    resetFilters();
    refetch();
  }

  const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "";
  const requestedByLabel =
    requestedBy == null
      ? "Tous"
      : requestedBy === user?.id
        ? "Moi"
        : (members.find((member) => member.user === requestedBy)?.user_display_name ?? "Membre");
  const folderLabel = folderId == null ? "Tous" : (findFolderName(folders, folderId) ?? "Dossier");
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortField)?.label ?? "";

  return (
    <View className="flex-1">
      <FlatList
        data={requests}
        keyExtractor={(item) => String(item.id)}
        // Place reservee a la barre et au bouton flottants.
        contentContainerStyle={
          requests.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20, paddingTop: GLASS_BAR_HEIGHT + 16 }
            : {
                paddingHorizontal: 20,
                paddingTop: GLASS_BAR_HEIGHT + 16,
                paddingBottom: canEdit ? GLASS_FAB_CLEARANCE : 24,
              }
        }
        refreshControl={<ThemedRefreshControl refreshing={isFetching} onRefresh={handleRefresh} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}

            {!isError && requests.length > 0 ? (
              <Text className="text-xs text-muted">{count} demande{count > 1 ? "s" : ""}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState title="Aucune demande" description="Aucune demande ne correspond a ces filtres." />
          ) : null
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            canApprove={canApprove}
            isApproving={approveRequest.isPending && approveRequest.variables === item.id}
            isRejecting={rejectRequest.isPending && rejectRequest.variables === item.id}
            disableActions={approveRequest.isPending || rejectRequest.isPending}
            onApprove={() => approveRequest.mutate(item.id)}
            onReject={() => rejectRequest.mutate(item.id)}
            onPress={() => router.push({ pathname: "/requests/[id]", params: { id: String(item.id) } })}
          />
        )}
      />

      <FolderPickerModal
        visible={folderPickerOpen}
        folders={folders}
        selectedFolderId={folderId}
        onSelect={(id) => setFolderId(id)}
        onClose={() => setFolderPickerOpen(false)}
      />

      <GlassBar>
        <GlassCapsule style={{ flex: 1 }}>
          <View className="h-11 flex-row items-center gap-2 px-4">
            <Search size={theme.iconSize.sm} color={theme.colors.muted} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une demande"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              className="h-11 flex-1 border-0 bg-transparent px-0"
            />
          </View>
        </GlassCapsule>
        <SelectFilterPill
          label={sortField ? sortLabel : "Tri"}
          title="Trier par"
          options={SORT_OPTIONS}
          value={sortField}
          onSelect={(value) => setSortField(value as SortField)}
          active={Boolean(sortField)}
        />
        <FilterTrigger activeCount={activeFilters} onPress={() => setFilterSheetOpen(true)} />
      </GlassBar>

      {canEdit ? (
        <GlassFab
          icon={Plus}
          label="Nouvelle demande"
          onPress={() => router.push("/requests/create")}
        />
      ) : null}

      <RequestFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        status={{
          label: statusLabel,
          title: "Statut",
          options: STATUS_OPTIONS,
          value: statusFilter,
          onSelect: (value) => setStatusFilter(value as RequestStatusFilter),
        }}
        requestedBy={{
          label: `Demande par : ${requestedByLabel}`,
          title: "Demande par",
          options: buildMemberFilterOptions(members, user?.id ?? null),
          value: requestedBy == null ? "all" : String(requestedBy),
          onSelect: (value) => setRequestedBy(value === "all" ? null : Number(value)),
        }}
        folderLabel={folderLabel}
        onPickFolder={() => setFolderPickerOpen(true)}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        showRejectedDisplay={showRejectedDisplay}
        onToggleShowRejected={() => setShowRejected((value) => !value)}
        onReset={resetFilters}
      />
    </View>
  );
}

function RequestCard({
  request,
  canApprove,
  isApproving,
  isRejecting,
  disableActions,
  onApprove,
  onReject,
  onPress,
}: {
  request: ExpenseRequest;
  canApprove: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  disableActions: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: `${theme.colors.foreground}1f` }}
      className="gap-2 rounded-md border border-border bg-surface p-4"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
              {request.title}
            </Text>
            <Text className="text-sm font-semibold text-foreground">{formatMoney(request.amount)}</Text>
          </View>
          {request.category ? (
            <Text className="text-xs text-muted" numberOfLines={1}>
              {request.category}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={theme.iconSize.sm} color={theme.colors.muted} />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <RequestStatusBadge status={request.status} />
        {request.requested_by_name ? (
          <Text className="text-xs text-muted">{request.requested_by_name}</Text>
        ) : null}
        <Text className="text-xs text-muted">{formatDate(request.created_at)}</Text>
      </View>

      {canApprove && request.status === "pending" ? (
        <View className="flex-row gap-2 pt-1">
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            disabled={disableActions}
            accessibilityRole="button"
            className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-border bg-background"
            style={{ opacity: disableActions ? 0.5 : 1 }}
          >
            {isApproving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <CheckCircle2 size={14} color={theme.colors.primary} />
            )}
            <Text className="text-xs font-medium text-foreground">
              {isApproving ? "Approbation..." : "Approuver"}
            </Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onReject();
            }}
            disabled={disableActions}
            accessibilityRole="button"
            className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-danger/10"
            style={{ opacity: disableActions ? 0.5 : 1 }}
          >
            {isRejecting ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <XCircle size={14} color={theme.colors.danger} />
            )}
            <Text className="text-xs font-medium text-danger">{isRejecting ? "Refus..." : "Refuser"}</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}
