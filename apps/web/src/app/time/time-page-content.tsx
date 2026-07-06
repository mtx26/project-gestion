"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock3, Lock, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { DocumentPreviewDialog } from "@/components/dialogs/document-preview-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useDocumentPreview } from "@/lib/use-document-preview";
import {
  buildTargetTree,
  findTargetLabel,
} from "@/lib/target-utils";
import { parseBooleanParam, parsePageParam } from "@/lib/url-params";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useProjectResources } from "@/lib/use-project-resources";
import { useUrlFilter } from "@/lib/use-url-filter";
import { PaginationBar } from "@/components/pagination-bar";
import { TimeSummary, TimeTotalsPanel } from "./components/time-totals-panel";
import { TimeEntryList } from "./components/time-entry-list";
import { CollapsibleFilterBar } from "@/components/filters/collapsible-filter-bar";
import { FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { FilterPeriodPicker } from "@/components/filters/filter-period-picker";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import { type TimeEntrySubmitData, CorrectPaymentDialog, PaymentDialog, TimeEntryDetailModal, TimeEntryFormDialog } from "./components/time-dialogs";
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
  const searchParams = useSearchParams();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewAllTime = can(permissionCodes.timeEntryViewAll);
  const canRecordTime = can(permissionCodes.timeEntryEdit);
  const canPayTime = can(permissionCodes.timeEntryPay);
  const canDeleteTime = can(permissionCodes.timeEntryDelete);
  const canViewTasks = can(permissionCodes.taskView);
  const defaultUserFilter: UserFilter = canViewAllTime ? "all" : "mine";
  const userFilter = parseUserFilter(searchParams.get("user"), defaultUserFilter, canViewAllTime);
  const paymentStatusFilter = parsePaymentStatusFilter(searchParams.get("payment"));
  const dateFrom = searchParams.get("date_from") ?? undefined;
  const dateTo = searchParams.get("date_to") ?? undefined;
  const targetFilter = parseTargetFilter(searchParams.get("target"));
  const includePaid = parseBooleanParam(searchParams.get("include_paid"));
  const selectedUserId = getSelectedUserId(userFilter, user?.id ?? null);
  const userFilterId: number | null =
    userFilter === "all" ? null :
    userFilter === "mine" ? (user?.id ?? null) :
    Number(userFilter.replace("member-", ""));
  const periodRange = useMemo(
    () => ({ startDate: dateFrom, endDate: dateTo }),
    [dateFrom, dateTo],
  );

  const [timeFormOpen, setTimeFormOpen] = useState(searchParams.get("new") === "1");
  const defaultHourlyRate = user?.profile?.default_hourly_rate ?? "0";
  const [paymentTarget, setPaymentTarget] = useState<TimeEntry | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const page = parsePageParam(searchParams.get("page"));

  const updateUrlFilter = useUrlFilter("/time", searchParams, projectId);
  const { folders, targetFolders, members, folderNameById, handleCreateFolder } = useProjectResources(projectId, {
    canView: canViewTime,
    canEdit: canRecordTime,
    canFetchMembers: canViewAllTime,
  });

  const timeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.list(selectedProject.id, {
          userId: selectedUserId ?? "all",
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          includePaid,
          paymentStatus: paymentStatusFilter,
          target: targetFilter ?? undefined,
          page,
        })
      : queryKeys.disabled(),
    queryFn: () =>
      api.timeEntries.list(selectedProject!.id, {
        ...(selectedUserId == null ? {} : { user: selectedUserId }),
        start_date: periodRange.startDate,
        end_date: periodRange.endDate,
        include_paid: includePaid,
        payment_status: paymentStatusFilter,
        target: targetFilter ?? undefined,
        page,
      }),
    enabled: Boolean(projectId && canViewTime),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.stats(selectedProject.id, {
          userId: selectedUserId ?? "all",
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          includePaid,
          paymentStatus: paymentStatusFilter,
          target: targetFilter ?? undefined,
        })
      : queryKeys.disabled(),
    queryFn: () =>
      api.timeEntries.stats(selectedProject!.id, {
        ...(selectedUserId == null ? {} : { user: selectedUserId }),
        start_date: periodRange.startDate,
        end_date: periodRange.endDate,
        include_paid: includePaid,
        payment_status: paymentStatusFilter,
        target: targetFilter ?? undefined,
      }),
    enabled: Boolean(projectId && canViewTime),
  });

  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const totalCount = getApiCount(timeEntriesQuery.data);
  const targetTree = buildTargetTree(targetFolders);
  const userNameById = new Map(members.map((m): [number, string] => [m.user, m.user_display_name]));
  const totals = {
    durationMinutes: statsQuery.data?.duration_minutes ?? 0,
    costAmount: Number(statsQuery.data?.cost_amount ?? 0),
    remainingAmount: Number(statsQuery.data?.remaining_amount ?? 0),
  };
  const targetFilterLabel = targetFilter ? findTargetLabel(targetTree, targetFilter) : null;
  const selectedFolderFilterId = targetFilter?.startsWith("folder-") ? Number(targetFilter.replace("folder-", "")) : null;
  const filterFolderLabel = selectedFolderFilterId != null ? (folderNameById.get(selectedFolderFilterId) ?? "Dossier") : null;
  const totalsLabel = getTotalsLabel(userFilter, paymentStatusFilter, dateFrom, dateTo, members, user?.id ?? null, targetFilterLabel);

  const createTimeEntry = useCrudMutation({
    mutationFn: (data: TimeEntrySubmitData) =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        start_date: data.startDate,
        duration_minutes: data.durationMinutes,
        hourly_rate: data.hourlyRate,
        description: data.description,
        folder: data.folder,
        task: data.task,
        documents: data.documentIds,
      }),
    invalidateKey: queryKeys.timeEntries.all(selectedProject!.id),
    successMessage: "Temps enregistre",
    onSuccess: () => setTimeFormOpen(false),
  });
  const deleteTimeEntry = useCrudMutation({
    mutationFn: (timeEntryId: number) => api.timeEntries.remove(selectedProject!.id, timeEntryId),
    invalidateKey: queryKeys.timeEntries.all(selectedProject!.id),
    successMessage: "Entree supprimee",
    onSuccess: () => setDeletingEntry(null),
  });
  const payTimeEntry = useCrudMutation({
    mutationFn: (values: { mode: "full" | "partial"; amount: string }) =>
      api.timeEntries.pay(selectedProject!.id, paymentTarget!.id, {
        pay_full: values.mode === "full",
        amount: values.mode === "partial" ? values.amount : undefined,
      }),
    invalidateKey: [queryKeys.timeEntries.all(selectedProject!.id), queryKeys.financialEntries.all(selectedProject!.id)],
    successMessage: "Paiement enregistre",
    onSuccess: () => setPaymentTarget(null),
  });
  const correctTimeEntryPayment = useCrudMutation({
    mutationFn: (amount: string) =>
      api.timeEntries.correctPayment(selectedProject!.id, correctionTarget!.id, { amount }),
    invalidateKey: [queryKeys.timeEntries.all(selectedProject!.id), queryKeys.financialEntries.all(selectedProject!.id)],
    successMessage: "Paiement corrige",
    onSuccess: () => setCorrectionTarget(null),
  });
  const updateTimeEntry = useCrudMutation({
    mutationFn: (data: TimeEntrySubmitData) =>
      api.timeEntries.update(selectedProject!.id, editingEntry!.id, {
        duration_minutes: data.durationMinutes,
        start_date: data.startDate,
        hourly_rate: data.hourlyRate,
        description: data.description,
        folder: data.folder,
        task: data.task,
        documents: data.documentIds,
      }),
    invalidateKey: queryKeys.timeEntries.all(selectedProject!.id),
    successMessage: "Temps mis a jour",
    onSuccess: () => setEditingEntry(null),
  });

  const openTask = useCrudMutation({
    mutationFn: (taskId: number) => api.tasks.get(projectId!, taskId),
    errorMessage: "Impossible de charger la tache",
    onSuccess: setViewingTask,
  });

  function handleTaskClick(taskId: number) {
    if (!projectId) return;
    openTask.mutate(taskId);
  }

  if (projectsQuery.isLoading) return <Skeleton className="h-72 rounded-lg" />;

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={Clock3}
        description="Cree ou selectionne un projet pour enregistrer du temps."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewTime && !canRecordTime) {
    return <AccessDeniedState description="Ton role ne permet pas de consulter ni d'enregistrer des heures sur ce projet." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Temps" title="Suivi du travail" />
        {canRecordTime ? (
          <Button type="button" className="gap-2" onClick={() => setTimeFormOpen(true)}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      <FormErrorAlert error={canViewTime ? getErrorMessage(timeEntriesQuery.error) : null} />

      {canViewTime ? (
        <CollapsibleFilterBar
          primary={
            <FilterPeriodPicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(v) => updateUrlFilter({ date_from: v.date_from, date_to: v.date_to })}
            />
          }
          activeCount={[canViewAllTime && userFilterId !== null, targetFilter != null, paymentStatusFilter !== "all", includePaid].filter(Boolean).length}
          clearPath="/time"
          clearKeys={["period", "date_from", "date_to", "user", "payment", "target", "include_paid", "page"]}
        >
          <FilterSelect
            value={paymentStatusFilter}
            onValueChange={(v) => updateUrlFilter({ payment: v, ...(v === "paid" ? { include_paid: true } : {}) })}
          >
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="not_paid">Non réglé</SelectItem>
            <SelectItem value="unpaid">À payer</SelectItem>
            <SelectItem value="partial">Partiel</SelectItem>
            <SelectItem value="paid">Payé</SelectItem>
          </FilterSelect>
          {canViewAllTime ? (
            <MemberFilterSelect
              members={members}
              value={userFilterId}
              currentUserId={user?.id ?? null}
              selfLabel="Mes heures"
              onChange={(id) => updateUrlFilter({ user: id === null ? null : `member-${id}` })}
            />
          ) : null}
          <FilterFolderPicker
            folders={folders}
            selectedFolderId={selectedFolderFilterId}
            buttonLabel={filterFolderLabel ?? "Tous dossiers"}
            description="Filtrer les entrées de temps par dossier."
            onSelect={(folderId) => updateUrlFilter({ target: folderId == null ? null : `folder-${folderId}` })}
            onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
          />
          <FilterToggle pressed={includePaid} onPressedChange={(v) => updateUrlFilter({ include_paid: v })}>
            Inclure payés
          </FilterToggle>
        </CollapsibleFilterBar>
      ) : null}

      <div className={canRecordTime && canViewTime ? "grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start" : "grid gap-4"}>
        {canRecordTime && canViewTime ? (
          <TimeTotalsPanel
            label={totalsLabel}
            totals={totals}
            entries={timeEntries}
            userNameById={userNameById}
            currentUserId={user?.id ?? null}
          />
        ) : null}

        {!canRecordTime && canViewTime ? (
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

        {canViewTime ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Entrees de temps</CardTitle>
            </CardHeader>
            <CardContent>
              {!canViewAllTime && canViewTime ? (
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
        onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { setTimeFormOpen(open); if (!open) createTimeEntry.reset(); }}
        onSubmit={(data) => { if (selectedProject && user && canRecordTime) createTimeEntry.mutate(data); }}
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
        targetFolders={targetFolders}
        isPending={updateTimeEntry.isPending}
        error={updateTimeEntry.error}
        onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { if (!open) { setEditingEntry(null); updateTimeEntry.reset(); } }}
        onSubmit={(data) => updateTimeEntry.mutate(data)}
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
        onCorrectPayment={(entry) => { setViewingEntry(null); setCorrectionTarget(entry); }}
        onDelete={(entry) => { setViewingEntry(null); setDeletingEntry(entry); }}
        onTaskClick={canViewTasks ? (taskId) => { setViewingEntry(null); handleTaskClick(taskId); } : undefined}
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
