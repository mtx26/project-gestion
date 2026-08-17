"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import {
  buildTimeEntriesListQuery,
  getApiCount,
  getApiPageSize,
  normalizeApiList,
  type TimeEntryListFilters,
  type TimeEntryScopeQuery,
} from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Lock, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { DocumentPreviewDialog } from "@/components/dialogs/document-preview-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { ProjectAccessGate } from "@/components/states/project-access-gate";
import { PageHeader } from "@/components/page-title";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { invalidateProjectResource } from "@/lib/invalidate-project-resource";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useDocumentPreview } from "@/lib/use-document-preview";
import {
  findTargetLabel,
  getTargetPayload,
  type EntryTarget,
} from "@/lib/target-utils";
import { buildProjectHref, parsePageParam } from "@/lib/url-params";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useProjectResources } from "@/lib/use-project-resources";
import { useSearchParam } from "@/lib/use-search-param";
import { useUrlFilter } from "@/lib/use-url-filter";
import { PaginationBar } from "@/components/pagination-bar";
import { TimeSummary, TimeTotalsPanel } from "./components/time-totals-panel";
import { TimeEntryList } from "./components/time-entry-list";
import { CollapsibleFilterBar } from "@/components/filters/collapsible-filter-bar";
import { FilterFolderPicker, FilterSearch, FilterSelect } from "@/components/filters/filter-bar";
import { FilterPeriodPicker } from "@/components/filters/filter-period-picker";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import { type TimeEntrySubmitData, BulkPaymentDialog, CorrectPaymentDialog, PaymentDialog, TimeEntryDetailModal, TimeEntryFormDialog } from "./components/time-dialogs";
import {
  type UserFilter,
  getSelectedUserId,
  getTotalsLabel,
  parsePaymentStatusFilter,
  parseTargetFilter,
  parseUserFilter,
} from "./lib/time-filters";
import { formatDuration, formatMoney } from "@/lib/task-utils";

export function TimePageContent() {
  return (
    <ProjectWorkspaceShell>
      {(state) => <TimeView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function TimeView({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
}: ProjectWorkspaceState) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewAllTime = can(permissionCodes.timeEntryViewAll);
  const canViewOthersDetail = can(permissionCodes.timeEntryViewOthersDetail);
  const canRecordTime = can(permissionCodes.timeEntryEdit);
  const canPayTime = can(permissionCodes.timeEntryPay);
  const canDeleteTime = can(permissionCodes.timeEntryDelete);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewFiles = can(permissionCodes.fileView);
  // Un payeur sans `time_entry.view_others_detail` ne voit que ses propres entrees dans la
  // liste, ce qui n'a rien a voir avec ce qu'il paie : la page se reduit alors a la synthese
  // (totaux + repartition par membre) et au bouton de paiement groupe.
  const showEntryList = canViewTime && (canViewOthersDetail || !canPayTime);
  const showTotalsPanel = canViewTime && (canRecordTime || canPayTime);
  // Meme regle que le dashboard : sans avoir a payer qui que ce soit, on arrive sur ses
  // propres heures. Un payeur, lui, ouvre la page pour suivre l'equipe. Le selecteur de
  // membre reste disponible des `time_entry.view_all` dans les deux cas.
  const defaultUserFilter: UserFilter = canViewAllTime && canPayTime ? "all" : "mine";
  const userFilter = parseUserFilter(searchParams.get("user"), defaultUserFilter, canViewAllTime);
  const paymentStatusFilter = parsePaymentStatusFilter(searchParams.get("payment"));
  const searchFromUrl = searchParams.get("search") ?? "";
  const dateFrom = searchParams.get("date_from") ?? undefined;
  const dateTo = searchParams.get("date_to") ?? undefined;
  const targetFilter = parseTargetFilter(searchParams.get("target"));
  const selectedUserId = getSelectedUserId(userFilter, user?.id ?? null);
  const userFilterId: number | "none" | null =
    userFilter === "all" ? null :
    userFilter === "none" ? "none" :
    userFilter === "mine" ? (user?.id ?? null) :
    Number(userFilter.replace("member-", ""));
  const periodRange = useMemo(
    () => ({ startDate: dateFrom, endDate: dateTo }),
    [dateFrom, dateTo],
  );

  const [timeFormOpen, setTimeFormOpen] = useState(searchParams.get("new") === "1");
  const defaultHourlyRate = user?.profile?.default_hourly_rate ?? "0";
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<TimeEntry | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const page = parsePageParam(searchParams.get("page"));

  const updateUrlFilter = useUrlFilter("/time", searchParams, projectId);
  const [searchQuery, handleSearchChange] = useSearchParam(searchFromUrl, updateUrlFilter);
  const { folders, targetFolders, members, folderNameById, handleCreateFolder } = useProjectResources(projectId, {
    canView: canViewTime,
    canEdit: canRecordTime,
    canFetchMembers: canViewAllTime,
  });

  const timeFilters: TimeEntryListFilters = {
    userId: selectedUserId ?? "all",
    startDate: periodRange.startDate,
    endDate: periodRange.endDate,
    paymentStatus: paymentStatusFilter,
    target: targetFilter ?? undefined,
    search: searchFromUrl || undefined,
  };

  const timeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? buildTimeEntriesListQuery(api, selectedProject.id, timeFilters, page).queryKey
      : queryKeys.disabled(),
    queryFn: () => buildTimeEntriesListQuery(api, selectedProject!.id, timeFilters, page).queryFn(),
    enabled: Boolean(projectId && showEntryList),
    placeholderData: keepPreviousData,
  });

  // Scope serveur partage par la synthese et le paiement groupe : le montant payable est
  // exactement le "reste a payer" affiche pour ces memes filtres.
  const scopeQuery: TimeEntryScopeQuery = {
    ...(selectedUserId == null ? {} : { user: selectedUserId }),
    start_date: periodRange.startDate,
    end_date: periodRange.endDate,
    payment_status: paymentStatusFilter,
    target: targetFilter ?? undefined,
  };

  const statsQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.stats(selectedProject.id, {
          userId: selectedUserId ?? "all",
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
                paymentStatus: paymentStatusFilter,
          target: targetFilter ?? undefined,
        })
      : queryKeys.disabled(),
    queryFn: () => api.timeEntries.stats(selectedProject!.id, scopeQuery),
    enabled: Boolean(projectId && canViewTime),
  });

  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const totalCount = getApiCount(timeEntriesQuery.data);
  const userNameById = new Map(members.map((m): [number, string] => [m.user, m.user_display_name]));
  const totals = {
    durationMinutes: statsQuery.data?.duration_minutes ?? 0,
    costAmount: Number(statsQuery.data?.cost_amount ?? 0),
    remainingAmount: Number(statsQuery.data?.remaining_amount ?? 0),
  };
  const targetFilterLabel = targetFilter ? findTargetLabel(targetFolders, targetFilter) : null;
  const selectedFolderFilterId = targetFilter ? getTargetPayload(targetFilter).folder : null;
  const filterFolderLabel = selectedFolderFilterId != null ? (folderNameById.get(selectedFolderFilterId) ?? "Dossier") : null;
  const totalsLabel = getTotalsLabel(userFilter, paymentStatusFilter, dateFrom, dateTo, members, user?.id ?? null, targetFilterLabel);
  // Un paiement cible une personne : les beneficiaires viennent du `by_user` des stats,
  // visible des `time_entry.view_all` — donc disponible meme sans acces au detail des entrees.
  // La ligne `user: null` (entrees orphelines d'un compte supprime) n'est payable par
  // personne et sort donc de la liste, meme si elle pese dans le total affiche.
  const payees = (statsQuery.data?.by_user ?? [])
    .filter((row): row is typeof row & { user: number } => row.user != null)
    .map((row) => ({
      userId: row.user,
      name: row.user === user?.id ? "Toi" : (userNameById.get(row.user) ?? `Utilisateur ${row.user}`),
      remainingAmount: Number(row.remaining_amount),
    }))
    .filter((payee) => payee.remainingAmount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const createTimeEntry = useCrudMutation({
    mutationFn: (data: TimeEntrySubmitData) =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        title: data.title,
        start_date: data.startDate,
        duration_minutes: data.durationMinutes,
        hourly_rate: data.hourlyRate,
        description: data.description,
        folder: data.folder,
        task: data.task,
        documents: data.documentIds,
      }),
    invalidateKey: queryKeys.timeEntries.all(projectId ?? 0),
    successMessage: "Temps enregistre",
    onSuccess: () => setTimeFormOpen(false),
  });
  const deleteTimeEntry = useCrudMutation({
    mutationFn: (timeEntryId: number) => api.timeEntries.remove(selectedProject!.id, timeEntryId),
    invalidateKey: queryKeys.timeEntries.all(projectId ?? 0),
    successMessage: "Entree supprimee",
    onSuccess: () => setDeletingEntry(null),
  });
  const bulkPayTimeEntries = useCrudMutation({
    mutationFn: (values: { userId: number; amount: string }) =>
      api.timeEntries.bulkPay(
        selectedProject!.id,
        { ...scopeQuery, user: values.userId },
        { amount: values.amount },
      ),
    invalidateKey: [queryKeys.timeEntries.all(projectId ?? 0), queryKeys.financialEntries.all(projectId ?? 0)],
    successMessage: "Paiement enregistre",
    onSuccess: () => setBulkPaymentOpen(false),
    // Un refus vient le plus souvent d'un reste a payer perime (paiement concurrent, filtres
    // deplaces) : on recharge le scope pour que le dialog reaffiche les bons montants avant
    // que l'utilisateur ne retente.
    onError: () => { void invalidateProjectResource(queryClient, queryKeys.timeEntries.all(projectId ?? 0)); },
  });
  const payTimeEntry = useCrudMutation({
    mutationFn: (values: { mode: "full" | "partial"; amount: string }) =>
      api.timeEntries.pay(selectedProject!.id, paymentTarget!.id, {
        pay_full: values.mode === "full",
        amount: values.mode === "partial" ? values.amount : undefined,
      }),
    invalidateKey: [queryKeys.timeEntries.all(projectId ?? 0), queryKeys.financialEntries.all(projectId ?? 0)],
    successMessage: "Paiement enregistre",
    onSuccess: () => setPaymentTarget(null),
  });
  const correctTimeEntryPayment = useCrudMutation({
    mutationFn: (amount: string) =>
      api.timeEntries.correctPayment(selectedProject!.id, correctionTarget!.id, { amount }),
    invalidateKey: [queryKeys.timeEntries.all(projectId ?? 0), queryKeys.financialEntries.all(projectId ?? 0)],
    successMessage: "Paiement corrige",
    onSuccess: () => setCorrectionTarget(null),
  });
  const updateTimeEntry = useCrudMutation({
    mutationFn: (data: TimeEntrySubmitData) =>
      api.timeEntries.update(selectedProject!.id, editingEntry!.id, {
        title: data.title,
        duration_minutes: data.durationMinutes,
        start_date: data.startDate,
        hourly_rate: data.hourlyRate,
        description: data.description,
        folder: data.folder,
        task: data.task,
        documents: data.documentIds,
        ...(data.user == null ? {} : { user: data.user }),
      }),
    invalidateKey: queryKeys.timeEntries.all(projectId ?? 0),
    successMessage: "Temps mis a jour",
    onSuccess: () => setEditingEntry(null),
  });

  const openTask = useCrudMutation({
    mutationFn: (taskId: number) => api.tasks.get(projectId!, taskId),
    errorMessage: "Impossible de charger la tache",
    onSuccess: setViewingTask,
  });

  function handleTargetClick(target: EntryTarget) {
    if (!projectId) return;
    setViewingEntry(null);
    if (target.type === "task") {
      openTask.mutate(target.id);
    } else {
      router.push(buildProjectHref("/files", projectId));
    }
  }

  const periodFilter = (
    <FilterPeriodPicker
      dateFrom={dateFrom}
      dateTo={dateTo}
      onChange={(v) => updateUrlFilter({ date_from: v.date_from, date_to: v.date_to })}
    />
  );

  if (projectsQuery.isLoading || !selectedProject || (!canViewTime && !canRecordTime)) {
    return (
      <ProjectAccessGate
        isLoadingProjects={projectsQuery.isLoading}
        hasProject={Boolean(selectedProject)}
        hasAccess={canViewTime || canRecordTime}
        icon={Clock3}
        noProjectDescription="Cree ou selectionne un projet pour enregistrer du temps."
        accessDeniedDescription="Ton role ne permet pas de consulter ni d'enregistrer des heures sur ce projet."
        onCreateProject={openCreateProject}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader category="Temps" title="Suivi du travail">
        {canRecordTime ? (
          <Button type="button" className="gap-2" onClick={() => setTimeFormOpen(true)}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </PageHeader>

      <FormErrorAlert error={showEntryList ? getErrorMessage(timeEntriesQuery.error) : null} />

      {canViewTime ? (
        <CollapsibleFilterBar
          // Sans liste d'entrees, la recherche n'a plus de cible (elle ne filtre pas la
          // synthese, qui ignore `search`) : la periode prend alors le filtre principal.
          primary={showEntryList ? <FilterSearch value={searchQuery} onChange={handleSearchChange} /> : periodFilter}
          activeCount={[showEntryList && Boolean(dateFrom), canViewAllTime && userFilterId !== null, targetFilter != null, paymentStatusFilter !== "not_paid"].filter(Boolean).length}
          clearPath="/time"
          clearKeys={["search", "date_from", "date_to", "user", "payment", "target", "page"]}
        >
          {showEntryList ? periodFilter : null}
          <FilterSelect
            value={paymentStatusFilter}
            // `not_paid` etant le defaut, il sort de l'URL au lieu d'y etre ecrit.
            onValueChange={(v) => updateUrlFilter({ payment: v === "not_paid" ? null : v })}
          >
            <SelectItem value="not_paid">Non réglé</SelectItem>
            <SelectItem value="unpaid">Pas payé</SelectItem>
            <SelectItem value="partial">Partiel</SelectItem>
            <SelectItem value="paid">Payé</SelectItem>
            <SelectItem value="all">Tous statuts</SelectItem>
          </FilterSelect>
          {canViewAllTime ? (
            <MemberFilterSelect
              members={members}
              value={userFilterId}
              currentUserId={user?.id ?? null}
              selfLabel="Mes heures"
              unassignedLabel="Non attribue"
              onChange={(id) => updateUrlFilter({ user: id === null ? null : id === "none" ? "none" : `member-${id}` })}
            />
          ) : null}
          <FilterFolderPicker
            folders={folders}
            selectedFolderId={selectedFolderFilterId}
            buttonLabel={filterFolderLabel ?? "Tous dossiers"}
            description="Filtrer les entrées de temps par dossier."
            onSelect={(folderId) => updateUrlFilter({ target: folderId == null ? null : `folder-${folderId}` })}
            onCreateFolderAction={canRecordTime ? handleCreateFolder : undefined}
          />
        </CollapsibleFilterBar>
      ) : null}

      <div className={showTotalsPanel && showEntryList ? "grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start" : "grid gap-4"}>
        {showTotalsPanel ? (
          <TimeTotalsPanel
            label={totalsLabel}
            totals={totals}
            byUser={statsQuery.data?.by_user ?? []}
            userNameById={userNameById}
            currentUserId={user?.id ?? null}
            onPay={canPayTime ? () => setBulkPaymentOpen(true) : undefined}
          />
        ) : null}

        {canViewTime && !showTotalsPanel ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{totalsLabel}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <TimeSummary label="Temps total" value={formatDuration(totals.durationMinutes)} />
              <TimeSummary label="Montant total" value={formatMoney(totals.costAmount)} />
              <TimeSummary label="Reste a payer" value={formatMoney(totals.remainingAmount)} />
            </div>
          </div>
        ) : null}

        {canRecordTime && !canViewTime ? (
          <Alert>
            <Lock className="size-4" />
            <AlertTitle>Liste non visible</AlertTitle>
            <AlertDescription>Tu peux enregistrer du temps, mais ton role ne permet pas de consulter les heures.</AlertDescription>
          </Alert>
        ) : null}

        {showEntryList ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Entrees de temps</CardTitle>
            </CardHeader>
            <CardContent>
              {!canViewOthersDetail ? (
                <p className="mb-3 text-sm text-muted-foreground">Vue limitee a tes propres entrees.</p>
              ) : null}
              <TimeEntryList
                entries={timeEntries}
                isLoading={timeEntriesQuery.isLoading}
                canPay={canPayTime}
                canEdit={canRecordTime}
                canDelete={canDeleteTime}
                deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
                onPay={setPaymentTarget}
                onEdit={setEditingEntry}
                onDetail={setViewingEntry}
                onDelete={setDeletingEntry}
              />
              <PaginationBar
                count={totalCount}
                page={page}
                pageSize={getApiPageSize(timeEntriesQuery.data)}
                onPageChange={(p) => updateUrlFilter({ page: p })}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <TimeEntryFormDialog
        mode="create"
        open={timeFormOpen}
        canRecordTime={canRecordTime}
        defaultHourlyRate={defaultHourlyRate}
        projectId={selectedProject?.id ?? 0}
        targetFolders={targetFolders}
        isPending={createTimeEntry.isPending}
        error={createTimeEntry.error}
        onCreateFolderAction={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { setTimeFormOpen(open); if (!open) createTimeEntry.reset(); }}
        onSubmit={(data) => { if (selectedProject && user && canRecordTime) createTimeEntry.mutate(data); }}
      />

      <BulkPaymentDialog
        key={bulkPaymentOpen ? "bulk-payment-open" : "bulk-payment-closed"}
        open={bulkPaymentOpen}
        scopeLabel={totalsLabel}
        payees={payees}
        defaultPayeeId={typeof userFilterId === "number" ? userFilterId : null}
        isPending={bulkPayTimeEntries.isPending}
        error={bulkPayTimeEntries.error}
        onOpenChange={(open) => { setBulkPaymentOpen(open); if (!open) bulkPayTimeEntries.reset(); }}
        onSubmit={(values) => bulkPayTimeEntries.mutate(values)}
      />
      <PaymentDialog
        key={paymentTarget?.id ?? "payment-none"}
        entry={paymentTarget}
        isPending={payTimeEntry.isPending}
        error={payTimeEntry.error}
        onOpenChange={(open) => { if (!open) { setPaymentTarget(null); payTimeEntry.reset(); } }}
        onSubmit={(values) => payTimeEntry.mutate(values)}
      />
      <CorrectPaymentDialog
        key={correctionTarget?.id ?? "correction-none"}
        entry={correctionTarget}
        isPending={correctTimeEntryPayment.isPending}
        error={correctTimeEntryPayment.error}
        onOpenChange={(open) => { if (!open) { setCorrectionTarget(null); correctTimeEntryPayment.reset(); } }}
        onSubmit={(amount) => correctTimeEntryPayment.mutate(amount)}
      />
      <TimeEntryFormDialog
        key={editingEntry?.id ?? "edit-none"}
        mode="edit"
        entry={editingEntry}
        projectId={selectedProject?.id ?? 0}
        canPay={canPayTime}
        targetFolders={targetFolders}
        members={members}
        isPending={updateTimeEntry.isPending}
        error={updateTimeEntry.error}
        onCreateFolderAction={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { if (!open) { setEditingEntry(null); updateTimeEntry.reset(); } }}
        onSubmit={(data) => updateTimeEntry.mutate(data)}
        onCorrectPayment={(entry) => { setEditingEntry(null); setCorrectionTarget(entry); }}
      />
      <TimeEntryDetailModal
        entry={viewingEntry}
        projectId={projectId ?? 0}
        canEdit={canRecordTime}
        canPay={canPayTime}
        canDelete={canDeleteTime}
        deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingEntry(null)}
        onEdit={(entry) => { setViewingEntry(null); setEditingEntry(entry); }}
        onPay={(entry) => { setViewingEntry(null); setPaymentTarget(entry); }}
        onDelete={(entry) => { setViewingEntry(null); setDeletingEntry(entry); }}
        canViewTaskTarget={canViewTasks}
        canViewFolderTarget={canViewFiles}
        onTargetClick={handleTargetClick}
      />
      <TaskDetailModal
        task={viewingTask}
        projectId={projectId ?? 0}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingTask(null)}
      />
      <DocumentPreviewDialog
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
      <ConfirmDeleteDialog
        open={deletingEntry != null}
        title="Supprimer cette entree de temps ?"
        isPending={deleteTimeEntry.isPending}
        onConfirm={() => deletingEntry && deleteTimeEntry.mutate(deletingEntry.id)}
        onClose={() => setDeletingEntry(null)}
      />
    </div>
  );
}
