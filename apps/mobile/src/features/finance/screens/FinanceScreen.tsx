import type { FinanceEntryListFilters } from "@project-gestion/api";
import { findFolderName } from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useRouter } from "expo-router";
import { Banknote, Plus, Search } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { FilterTrigger } from "../../../components/filters/FilterTrigger";
import { GlassBar, GLASS_BAR_HEIGHT } from "../../../components/ui/GlassBar";
import { GlassCapsule } from "../../../components/ui/GlassCapsule";
import { GlassFab, GLASS_FAB_CLEARANCE } from "../../../components/ui/GlassFab";
import { ProjectSectionScreen } from "../../../components/layout/ProjectSectionScreen";
import { FolderPickerModal } from "../../../components/pickers/FolderPickerModal";
import { Input } from "../../../components/ui/Input";
import { getErrorMessage } from "../../../lib/errors";
import { buildMemberFilterOptions } from "../../../lib/member-options";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectFolders, useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { FinanceEntryCard } from "../components/FinanceEntryCard";
import { FinanceFilterSheet } from "../components/FinanceFilterSheet";
import { FinanceTotalsCard } from "../components/FinanceTotalsCard";
import { useFinanceChart, useFinancialEntriesInfinite } from "../hooks/use-financial-entries";
import { ThemedRefreshControl } from "../../../components/ui/ThemedRefreshControl";
import {
  getChartRange,
  getOptionLabel,
  ORDERING_OPTIONS,
  SOURCE_OPTIONS,
  TYPE_OPTIONS,
  type OrderingFilter,
  type SourceFilter,
  type TypeFilter,
} from "../lib/finance-filters";

export function FinanceScreen() {
  return (
    <ProjectSectionScreen title="Finances" requiredPermission={permissionCodes.financeView}>
      {(project) => <FinanceListView project={project} />}
    </ProjectSectionScreen>
  );
}

function FinanceListView({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canEditFinance = can(permissionCodes.financeEdit);
  // `members.list` exige `member.view` : le filtre "cree par" disparait sans ce droit.
  const canViewMembers = can(permissionCodes.memberView);

  const { members } = useProjectMembers(canViewMembers ? project.id : null);
  const { folders } = useProjectFolders(project.id);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [createdBy, setCreatedBy] = useState<number | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [ordering, setOrdering] = useState<OrderingFilter>("");
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);

  const activeFilters = [
    Boolean(search),
    Boolean(dateFrom),
    Boolean(dateTo),
    typeFilter !== "all",
    sourceFilter !== "all",
    createdBy != null,
    folderId != null,
    ordering !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setSourceFilter("all");
    setCreatedBy(null);
    setFolderId(null);
    setOrdering("");
    setDateFrom(undefined);
    setDateTo(undefined);
  }

  const filters: FinanceEntryListFilters = {
    search,
    type: typeFilter === "all" ? undefined : typeFilter,
    source: sourceFilter === "all" ? undefined : sourceFilter,
    createdBy: createdBy ?? undefined,
    folderId: folderId ?? undefined,
    ordering: ordering || undefined,
    dateFrom,
    dateTo,
  };

  const {
    entries,
    count,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useFinancialEntriesInfinite(project.id, filters);

  const chartQuery = useFinanceChart(project.id, getChartRange(dateFrom, dateTo));

  const folderLabel = folderId == null ? "Tous" : (findFolderName(folders, folderId) ?? "Dossier");
  const createdByLabel =
    createdBy == null
      ? "Tous"
      : createdBy === user?.id
        ? "Moi"
        : (members.find((member) => member.user === createdBy)?.user_display_name ?? "Membre");
  const totalsLabel = [
    dateFrom || dateTo ? "periode filtree" : `annee ${new Date().getFullYear()}`,
    getOptionLabel(TYPE_OPTIONS, typeFilter).toLowerCase(),
  ].join(" - ");

  function handleRefresh() {
    resetFilters();
    refetch();
    chartQuery.refetch();
  }

  return (
    <View className="flex-1">
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        // Place reservee a la barre et au bouton flottants.
        contentContainerStyle={
          entries.length === 0
            ? { flexGrow: 1, paddingHorizontal: 20, paddingTop: GLASS_BAR_HEIGHT + 16 }
            : {
                paddingHorizontal: 20,
                paddingTop: GLASS_BAR_HEIGHT + 16,
                paddingBottom: canEditFinance ? GLASS_FAB_CLEARANCE : 24,
              }
        }
        refreshControl={
          <ThemedRefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={handleRefresh} />
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
            <FinanceTotalsCard label={totalsLabel} chart={chartQuery.data} />

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}

            {entries.length > 0 ? (
              <View className="flex-row items-center gap-2 pt-2">
                <Banknote size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="text-sm font-semibold text-foreground">Entrees financieres ({count})</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState
              title="Aucune entree financiere"
              description="Aucune entree ne correspond a ces filtres."
            />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingState /> : null}
        renderItem={({ item }) => (
          <FinanceEntryCard
            entry={item}
            onPress={() => router.push({ pathname: "/finance/[id]", params: { id: String(item.id) } })}
          />
        )}
      />

      <GlassBar>
        <GlassCapsule style={{ flex: 1 }}>
          <View className="h-11 flex-row items-center gap-2 px-4">
            <Search size={theme.iconSize.sm} color={theme.colors.muted} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une entree"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              className="h-11 flex-1 border-0 bg-transparent px-0"
            />
          </View>
        </GlassCapsule>
        <FilterTrigger activeCount={activeFilters} onPress={() => setFilterSheetOpen(true)} />
      </GlassBar>

      {canEditFinance ? (
        <GlassFab icon={Plus} label="Nouvelle entree" onPress={() => router.push("/finance/create")} />
      ) : null}

      <FinanceFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        type={{
          label: "Type",
          value: getOptionLabel(TYPE_OPTIONS, typeFilter),
          options: TYPE_OPTIONS,
          selected: typeFilter,
          onSelect: (value) => setTypeFilter(value as TypeFilter),
        }}
        source={{
          label: "Origine",
          value: getOptionLabel(SOURCE_OPTIONS, sourceFilter),
          options: SOURCE_OPTIONS,
          selected: sourceFilter,
          onSelect: (value) => setSourceFilter(value as SourceFilter),
        }}
        createdBy={{
          label: "Cree par",
          value: createdByLabel,
          options: buildMemberFilterOptions(members, user?.id ?? null),
          selected: createdBy == null ? "all" : String(createdBy),
          onSelect: (value) => setCreatedBy(value === "all" ? null : Number(value)),
        }}
        folderLabel={folderLabel}
        onPickFolder={() => setFolderPickerOpen(true)}
        ordering={{
          label: "Trier par",
          value: getOptionLabel(ORDERING_OPTIONS, ordering),
          options: ORDERING_OPTIONS,
          selected: ordering,
          onSelect: (value) => setOrdering(value as OrderingFilter),
        }}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onReset={resetFilters}
      />

      <FolderPickerModal
        visible={folderPickerOpen}
        folders={folders}
        selectedFolderId={folderId}
        onSelect={setFolderId}
        onClose={() => setFolderPickerOpen(false)}
      />
    </View>
  );
}
