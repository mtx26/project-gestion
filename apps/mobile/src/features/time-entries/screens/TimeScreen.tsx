import type { TimeEntryScopeQuery } from "@project-gestion/api";
import {
  defaultPaymentStatusFilter,
  findFolderName,
  getTargetPayload,
  type PaymentStatusFilter,
} from "@project-gestion/domain";
import { permissionCodes } from "@project-gestion/permissions";
import type { Project } from "@project-gestion/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Clock3, Plus, Search } from "lucide-react-native";
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
import { InlineMessage } from "../../../components/ui/InlineMessage";
import { getErrorMessage } from "../../../lib/errors";
import { buildMemberFilterOptions } from "../../../lib/member-options";
import { theme } from "../../../theme";
import { useAuthStore } from "../../../stores/auth-store";
import { useProjectFolders, useProjectMembers } from "../../projects/hooks/use-project-resources";
import { useProjectPermissions } from "../../projects/hooks/use-project-permissions";
import { BulkPaymentSheet } from "../components/BulkPaymentSheet";
import { TimeEntryCard } from "../components/TimeEntryCard";
import { TimeFilterSheet } from "../components/TimeFilterSheet";
import { TimeTotalsCard } from "../components/TimeTotalsCard";
import { useBulkPayTimeEntries, useTimeEntriesInfinite, useTimeEntryStats } from "../hooks/use-time-entries";
import { ThemedRefreshControl } from "../../../components/ui/ThemedRefreshControl";
import {
  buildTotalsLabel,
  getPaymentStatusFilterLabel,
  getUserFilterLabel,
  PAYMENT_STATUS_OPTIONS,
  type UserFilter,
} from "../lib/time-filters";

export function TimeScreen() {
  return (
    <ProjectSectionScreen
      title="Temps"
      requiredPermission={(can) => can(permissionCodes.timeEntryView) || can(permissionCodes.timeEntryEdit)}
    >
      {(project) => <TimeListView project={project} />}
    </ProjectSectionScreen>
  );
}

function TimeListView({ project }: { project: Project }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = useProjectPermissions(project, user?.id ?? null);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewAllTime = can(permissionCodes.timeEntryViewAll);
  const canViewOthersDetail = can(permissionCodes.timeEntryViewOthersDetail);
  const canRecordTime = can(permissionCodes.timeEntryEdit);
  const canPayTime = can(permissionCodes.timeEntryPay);
  // Un payeur sans `time_entry.view_others_detail` ne voit que ses propres entrees dans la
  // liste, ce qui n'a rien a voir avec ce qu'il paie : la page se reduit alors a la synthese
  // (totaux + repartition par membre) et au paiement groupe.
  const showEntryList = canViewTime && (canViewOthersDetail || !canPayTime);
  const showTotalsPanel = canViewTime && (canRecordTime || canPayTime);
  // Meme regle que le dashboard : sans avoir a payer qui que ce soit, on arrive sur ses
  // propres heures. Un payeur, lui, ouvre la page pour suivre l'equipe.
  const defaultUserFilter: UserFilter = canViewAllTime && canPayTime ? null : (user?.id ?? null);

  const params = useLocalSearchParams<{ target?: string }>();
  const { members } = useProjectMembers(canViewAllTime ? project.id : null);
  const { folders } = useProjectFolders(project.id);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>(defaultPaymentStatusFilter);
  const [userFilter, setUserFilter] = useState<UserFilter>(defaultUserFilter);
  // `target` n'est lu qu'a l'arrivee : c'est le point d'entree depuis l'explorateur de
  // fichiers ("voir le temps de ce dossier"), ensuite le filtre s'ajuste ici.
  const [folderFilterId, setFolderFilterId] = useState<number | null>(
    () => getTargetPayload(params.target ?? "").folder,
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);

  const targetFilter = folderFilterId == null ? undefined : `folder-${folderFilterId}`;
  const activeFilters = [
    Boolean(search),
    Boolean(dateFrom),
    Boolean(dateTo),
    canViewAllTime && userFilter !== null,
    targetFilter != null,
    paymentStatusFilter !== defaultPaymentStatusFilter,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setPaymentStatusFilter(defaultPaymentStatusFilter);
    setUserFilter(defaultUserFilter);
    setFolderFilterId(null);
    setDateFrom(undefined);
    setDateTo(undefined);
  }

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
  } = useTimeEntriesInfinite(
    project.id,
    {
      userId: userFilter ?? "all",
      startDate: dateFrom,
      endDate: dateTo,
      paymentStatus: paymentStatusFilter,
      target: targetFilter,
      search,
    },
    showEntryList,
  );

  // Scope serveur partage par la synthese et le paiement groupe : le montant payable est
  // exactement le "reste a payer" affiche pour ces memes filtres (`search` en moins, que
  // les stats ignorent).
  const scopeQuery: TimeEntryScopeQuery = {
    ...(userFilter == null ? {} : { user: userFilter }),
    start_date: dateFrom,
    end_date: dateTo,
    payment_status: paymentStatusFilter,
    target: targetFilter,
  };
  const statsQuery = useTimeEntryStats(project.id, scopeQuery, canViewTime);
  const bulkPayTimeEntries = useBulkPayTimeEntries(project.id, scopeQuery);

  const totals = {
    durationMinutes: statsQuery.data?.duration_minutes ?? 0,
    costAmount: Number(statsQuery.data?.cost_amount ?? 0),
    remainingAmount: Number(statsQuery.data?.remaining_amount ?? 0),
  };
  const userNameById = new Map(members.map((member): [number, string] => [member.user, member.user_display_name]));
  const folderFilterLabel = folderFilterId == null ? "Tous" : (findFolderName(folders, folderFilterId) ?? "Dossier");
  const totalsLabel = buildTotalsLabel({
    userFilter,
    paymentStatusFilter,
    dateFrom,
    dateTo,
    members,
    currentUserId: user?.id ?? null,
    targetLabel: folderFilterId == null ? null : folderFilterLabel,
  });
  // Un paiement cible une personne : les beneficiaires viennent du `by_user` des stats,
  // visible des `time_entry.view_all` — donc disponible meme sans acces au detail des
  // entrees. La ligne `user: null` (entrees orphelines d'un compte supprime) n'est payable
  // par personne et sort donc de la liste, meme si elle pese dans le total affiche.
  const payees = (statsQuery.data?.by_user ?? [])
    .filter((row): row is typeof row & { user: number } => row.user != null)
    .map((row) => ({
      userId: row.user,
      name: row.user === user?.id ? "Toi" : (userNameById.get(row.user) ?? `Utilisateur ${row.user}`),
      remainingAmount: Number(row.remaining_amount),
    }))
    .filter((payee) => payee.remainingAmount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  function handleRefresh() {
    resetFilters();
    refetch();
    statsQuery.refetch();
  }

  return (
    <View className="flex-1">
      <FlatList
        data={showEntryList ? entries : []}
        keyExtractor={(item) => String(item.id)}
        // Place reservee a la barre et au bouton flottants. La barre n'existe que
        // pour qui peut consulter le temps : sans ce droit, pas de marge a reserver.
        contentContainerStyle={
          entries.length === 0
            ? {
                flexGrow: 1,
                paddingHorizontal: 20,
                paddingTop: canViewTime ? GLASS_BAR_HEIGHT + 16 : 0,
              }
            : {
                paddingHorizontal: 20,
                paddingTop: canViewTime ? GLASS_BAR_HEIGHT + 16 : 0,
                paddingBottom: canRecordTime ? GLASS_FAB_CLEARANCE : 24,
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
            {showTotalsPanel ? (
              <TimeTotalsCard
                label={totalsLabel}
                totals={totals}
                byUser={statsQuery.data?.by_user ?? []}
                userNameById={userNameById}
                currentUserId={user?.id ?? null}
                onPay={canPayTime ? () => setBulkPaymentOpen(true) : undefined}
              />
            ) : null}

            {canRecordTime && !canViewTime ? (
              <InlineMessage>
                Tu peux enregistrer du temps, mais ton role ne permet pas de consulter les heures.
              </InlineMessage>
            ) : null}

            {isError ? <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} /> : null}

            {showEntryList && entries.length > 0 ? (
              <View className="flex-row items-center gap-2 pt-2">
                <Clock3 size={theme.iconSize.sm} color={theme.colors.muted} />
                <Text className="text-sm font-semibold text-foreground">Entrees de temps ({count})</Text>
              </View>
            ) : null}

            {showEntryList && !canViewOthersDetail ? (
              <Text className="text-xs text-muted">Vue limitee a tes propres entrees.</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !showEntryList ? null : isLoading ? (
            <LoadingState />
          ) : !isError ? (
            <EmptyState title="Aucune entree" description="Aucun temps enregistre pour cette vue." />
          ) : null
        }
        ListFooterComponent={isFetchingNextPage ? <LoadingState /> : null}
        renderItem={({ item }) => (
          <TimeEntryCard
            entry={item}
            onPress={() => router.push({ pathname: "/time/[id]", params: { id: String(item.id) } })}
          />
        )}
      />

      {canViewTime ? (
        <GlassBar>
          {showEntryList ? (
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
          ) : (
            <View className="flex-1" />
          )}
          <FilterTrigger activeCount={activeFilters} onPress={() => setFilterSheetOpen(true)} />
        </GlassBar>
      ) : null}

      {canRecordTime ? (
        <GlassFab icon={Plus} label="Ajouter du temps" onPress={() => router.push("/time/create")} />
      ) : null}

      <TimeFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        paymentStatus={{
          label: "Statut de paiement",
          value: getPaymentStatusFilterLabel(paymentStatusFilter),
          options: PAYMENT_STATUS_OPTIONS,
          selected: paymentStatusFilter,
          onSelect: (value) => setPaymentStatusFilter(value as PaymentStatusFilter),
        }}
        user={
          canViewAllTime
            ? {
                label: "Titulaire",
                value: getUserFilterLabel(userFilter, members, user?.id ?? null),
                options: buildMemberFilterOptions(members, user?.id ?? null, {
                  allLabel: "Tous les membres",
                  selfLabel: "Mes heures",
                  unassignedLabel: "Non attribue",
                }),
                selected: userFilter == null ? "all" : String(userFilter),
                onSelect: (value) =>
                  setUserFilter(value === "all" ? null : value === "none" ? "none" : Number(value)),
              }
            : undefined
        }
        targetLabel={folderFilterLabel}
        onPickTarget={() => setFolderPickerOpen(true)}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onReset={resetFilters}
      />

      <FolderPickerModal
        visible={folderPickerOpen}
        folders={folders}
        selectedFolderId={folderFilterId}
        onSelect={setFolderFilterId}
        onClose={() => setFolderPickerOpen(false)}
      />

      <BulkPaymentSheet
        // Remonte a chaque ouverture pour repartir des restes a payer courants.
        key={bulkPaymentOpen ? "bulk-payment-open" : "bulk-payment-closed"}
        visible={bulkPaymentOpen}
        scopeLabel={totalsLabel}
        payees={payees}
        defaultPayeeId={typeof userFilter === "number" ? userFilter : null}
        isPending={bulkPayTimeEntries.isPending}
        error={bulkPayTimeEntries.error}
        onClose={() => {
          setBulkPaymentOpen(false);
          bulkPayTimeEntries.reset();
        }}
        onSubmit={(values) =>
          bulkPayTimeEntries.mutate(
            { userId: values.userId, payload: { amount: values.amount } },
            { onSuccess: () => setBulkPaymentOpen(false) },
          )
        }
      />
    </View>
  );
}
