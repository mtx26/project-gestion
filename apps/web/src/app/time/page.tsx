"use client";

import type { TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, Lock, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { getDescendantFolderIds } from "@/lib/folder-utils";
import {
  buildTargetTree,
  collectTargetLabelsByType,
  collectTaskFolderIds,
  findTargetLabel,
  getTargetPayload,
} from "@/lib/target-utils";
import { buildFilterParams, parseBooleanParam } from "@/lib/url-params";
import { TimeSummary, TimeTotalsPanel } from "./components/time-totals-panel";
import { TimeCalendarView } from "./components/time-calendar-view";
import { TimeEntryForm } from "./components/time-entry-form";
import { TimeEntryList } from "./components/time-entry-list";
import { TimePeriodToolbar } from "./components/time-period-toolbar";
import { type EditTimeSubmitData, EditTimeEntryDialog, PaymentDialog, TimeEntryDetailDialog } from "./components/time-dialogs";
import {
  type PaymentStatusFilter,
  type PeriodPreset,
  type TimeViewMode,
  type UserFilter,
  buildTimeHref,
  filterTimeEntriesByPaymentStatus,
  filterTimeEntriesByTarget,
  getPeriodRange,
  getSelectedUserId,
  getTotalsLabel,
  invalidateTimeQueries,
  parsePaymentStatusFilter,
  parsePeriodPreset,
  parseTargetFilter,
  parseTimeViewMode,
  parseUserFilter,
  summarizeTimeEntries,
} from "./lib/time-filters";
import { formatDuration, formatMoney } from "@/lib/task-utils";

export default function TimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="time"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildTimeHref(id, searchParams))}
      onProjectCreated={(project) => router.push(buildTimeHref(project.id, searchParams))}
    >
      {(state) => <ProjectTimeContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectTimeContent({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
  queryClient,
}: ProjectWorkspaceState) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canViewTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryView);
  const canViewAllTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryViewAll);
  const canRecordTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryEdit);
  const canPayTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryPay);
  const canDeleteTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryDelete);
  const defaultUserFilter: UserFilter = canViewAllTime ? "all" : "mine";
  const userFilter = parseUserFilter(searchParams.get("user"), defaultUserFilter, canViewAllTime);
  const paymentStatusFilter = parsePaymentStatusFilter(searchParams.get("payment"));
  const periodPreset = parsePeriodPreset(searchParams.get("period"));
  const targetFilter = parseTargetFilter(searchParams.get("target"));
  const viewMode = parseTimeViewMode(searchParams.get("view"));
  const includeUnpaidOutsideMonth = parseBooleanParam(searchParams.get("include_unpaid"));
  const selectedUserId = getSelectedUserId(userFilter, user?.id ?? null);
  const periodRange = useMemo(() => getPeriodRange(periodPreset), [periodPreset]);

  const [targetValue, setTargetValue] = useState(parseTargetFilter(searchParams.get("target")) ?? "project");
  const [timeFormOpen, setTimeFormOpen] = useState(searchParams.get("new") === "1");
  const [createFormKey, setCreateFormKey] = useState(0);
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const defaultHourlyRate = user?.profile?.default_hourly_rate ?? "0";
  const [hourlyRateDraft, setHourlyRateDraft] = useState<string | null>(null);
  const hourlyRate = hourlyRateDraft ?? defaultHourlyRate;
  const [description, setDescription] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<TimeEntry | null>(null);

  const timeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.list(selectedProject.id, {
          userId: selectedUserId ?? "all",
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          includeUnpaid: includeUnpaidOutsideMonth,
        })
      : ["time-entries", "disabled"],
    queryFn: () =>
      api.timeEntries.list(selectedProject!.id, {
        ...(selectedUserId == null ? {} : { user: selectedUserId }),
        start_date: periodRange.startDate,
        end_date: periodRange.endDate,
        include_unpaid: includeUnpaidOutsideMonth,
      }),
    enabled: Boolean(selectedProject && canViewTime),
  });
  const membersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.members.list(selectedProject.id) : ["members", "disabled"],
    queryFn: () => api.members.list(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewAllTime),
  });
  const targetTreeQuery = useQuery({
    queryKey: selectedProject ? queryKeys.folders.targetTree(selectedProject.id) : ["folders", "target-tree", "disabled"],
    queryFn: () => api.folders.targetTree(selectedProject!.id),
    enabled: Boolean(selectedProject && canRecordTime),
  });
  const foldersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.folders.tree(selectedProject.id) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewTime),
  });

  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const members = normalizeApiList(membersQuery.data);
  const targetTree = useMemo(() => buildTargetTree(targetTreeQuery.data ?? []), [targetTreeQuery.data]);
  const selectedTargetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);
  const folderNameById = useMemo(() => collectTargetLabelsByType(targetTree, "folder"), [targetTree]);
  const taskTitleById = useMemo(() => collectTargetLabelsByType(targetTree, "task"), [targetTree]);
  const taskFolderById = useMemo(() => collectTaskFolderIds(targetTree), [targetTree]);
  const userNameById = useMemo(
    () => new Map(members.map((m): [number, string] => [m.user, m.user_display_name])),
    [members],
  );
  const descendantFolderIds = useMemo(() => {
    if (!targetFilter?.startsWith("folder-")) return null;
    return getDescendantFolderIds(foldersQuery.data ?? [], Number(targetFilter.replace("folder-", "")));
  }, [foldersQuery.data, targetFilter]);
  const visibleTimeEntries = useMemo(
    () => filterTimeEntriesByPaymentStatus(filterTimeEntriesByTarget(timeEntries, targetFilter, taskFolderById, descendantFolderIds), paymentStatusFilter),
    [paymentStatusFilter, targetFilter, taskFolderById, timeEntries, descendantFolderIds],
  );
  const totals = summarizeTimeEntries(visibleTimeEntries);
  const targetFilterLabel = targetFilter ? findTargetLabel(targetTree, targetFilter) : null;
  const totalsLabel = getTotalsLabel(userFilter, paymentStatusFilter, periodPreset, members, user?.id ?? null, targetFilterLabel);

  const createTimeEntry = useMutation({
    mutationFn: (documentIds: number[]) =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        duration_minutes: Number(hours) * 60 + Number(minutes),
        hourly_rate: hourlyRate === "" ? undefined : hourlyRate,
        description: description.trim() || null,
        folder: getTargetPayload(targetValue).folder,
        task: getTargetPayload(targetValue).task,
        documents: documentIds,
      }),
    onSuccess: async () => {
      toast.success("Temps enregistre");
      setHours("1"); setMinutes("0"); setHourlyRateDraft(null);
      setDescription(""); setTargetValue("project"); setTimeFormOpen(false);
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteTimeEntry = useMutation({
    mutationFn: (timeEntryId: number) => api.timeEntries.remove(selectedProject!.id, timeEntryId),
    onSuccess: async () => {
      toast.success("Entree supprimee");
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const payTimeEntry = useMutation({
    mutationFn: (values: { mode: "full" | "partial"; amount: string }) =>
      api.timeEntries.pay(selectedProject!.id, paymentTarget!.id, {
        pay_full: values.mode === "full",
        amount: values.mode === "partial" ? values.amount : undefined,
      }),
    onSuccess: async () => {
      toast.success("Paiement enregistre");
      setPaymentTarget(null);
      await Promise.all([
        invalidateTimeQueries(queryClient, selectedProject!.id),
        queryClient.invalidateQueries({ queryKey: ["projects", selectedProject!.id, "financial-entries"] }),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateTimeEntry = useMutation({
    mutationFn: (data: EditTimeSubmitData) =>
      api.timeEntries.update(selectedProject!.id, editingEntry!.id, {
        duration_minutes: data.durationMinutes,
        hourly_rate: data.hourlyRate,
        description: data.description,
        folder: data.folder,
        task: data.task,
        documents: data.documentIds,
      }),
    onSuccess: async () => {
      toast.success("Temps mis a jour");
      setEditingEntry(null);
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(selectedProject!.id, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(selectedProject!.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.targetTree(selectedProject!.id) }),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentId });
  }

  function onSubmitTimeEntry(event: React.FormEvent<HTMLFormElement>, documentIds: number[]) {
    event.preventDefault();
    if (!selectedProject || !user || !canRecordTime) return;
    createTimeEntry.mutate(documentIds);
  }


  function updateUrlFilter(changes: Partial<{
    user: UserFilter; payment: PaymentStatusFilter; period: PeriodPreset;
    target: string | null; view: TimeViewMode; include_unpaid: boolean;
  }>) {
    if (!selectedProject) return;
    const params = buildFilterParams(searchParams, selectedProject.id, changes);
    router.replace(`/time?${params.toString()}`, { scroll: false });
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
    return (
      <div className="space-y-5">
        <PageTitle category="Temps" title="Suivi du travail" />
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Suivi du temps indisponible</AlertTitle>
          <AlertDescription>Ton role ne permet pas de consulter ni d&apos;enregistrer des heures sur ce projet.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Temps" title="Suivi du travail" />
        {canRecordTime ? (
          <Button type="button" className="gap-2" onClick={() => { setCreateFormKey(k => k + 1); setTimeFormOpen(true); }}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      <FormErrorAlert error={canViewTime && timeEntriesQuery.error ? getErrorMessage(timeEntriesQuery.error) : null} />

      {canViewTime ? (
        <TimePeriodToolbar
          canViewAllTime={canViewAllTime}
          members={members}
          periodPreset={periodPreset}
          paymentStatusFilter={paymentStatusFilter}
          targetFilterLabel={targetFilterLabel}
          targetFolderId={targetFilter?.startsWith("folder-") ? Number(targetFilter.replace("folder-", "")) : null}
          userFilter={userFilter}
          includeUnpaidOutsideMonth={includeUnpaidOutsideMonth}
          folders={foldersQuery.data ?? []}
          onSelectFolder={(folderId) => updateUrlFilter({ target: folderId == null ? null : `folder-${folderId}` })}
          onPeriodPresetChange={(v) => updateUrlFilter({ period: v })}
          onPaymentStatusFilterChange={(v) => updateUrlFilter({ payment: v })}
          onUserFilterChange={(v) => updateUrlFilter({ user: v })}
          onIncludeUnpaidOutsideMonthChange={(v) => updateUrlFilter({ include_unpaid: v })}
          onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        />
      ) : null}

      <div className={canRecordTime && canViewTime && viewMode !== "calendar" ? "grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start" : "grid gap-4"}>
        {canViewTime ? (
          <Card className="rounded-lg">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Entrees de temps</CardTitle>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <Button type="button" variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => updateUrlFilter({ view: "list" })}>
                  Liste
                </Button>
                <Button type="button" variant={viewMode === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => updateUrlFilter({ view: "calendar" })}>
                  <CalendarDays className="size-3.5" />
                  Calendrier
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!canViewAllTime && canViewTime ? (
                <p className="mb-3 text-sm text-muted-foreground">Vue limitee a tes propres entrees.</p>
              ) : null}
              {viewMode === "calendar" ? (
                <TimeCalendarView
                  key={periodRange.startDate}
                  entries={visibleTimeEntries}
                  isLoading={timeEntriesQuery.isLoading}
                  userNameById={userNameById}
                  folderNameById={folderNameById}
                  taskTitleById={taskTitleById}
                  calendarDate={periodRange.startDate}
                />
              ) : (
                <TimeEntryList
                  entries={visibleTimeEntries}
                  isLoading={timeEntriesQuery.isLoading}
                  userNameById={userNameById}
                  folderNameById={folderNameById}
                  taskTitleById={taskTitleById}
                  canPay={canPayTime}
                  canEdit={canRecordTime}
                  canDelete={canDeleteTime}
                  deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
                  onPay={setPaymentTarget}
                  onEdit={setEditingEntry}
                  onDetail={setDetailEntry}
                  onDelete={(entry) => deleteTimeEntry.mutate(entry.id)}
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        {canRecordTime && canViewTime && viewMode !== "calendar" ? (
          <TimeTotalsPanel
            label={totalsLabel}
            totals={totals}
            entries={visibleTimeEntries}
            userNameById={userNameById}
            currentUserId={user?.id ?? null}
          />
        ) : null}

        {!canRecordTime && canViewTime && viewMode !== "calendar" ? (
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
      </div>

      <Dialog open={timeFormOpen} onOpenChange={(open) => { setTimeFormOpen(open); if (!open) createTimeEntry.reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle entree</DialogTitle>
            <DialogDescription>Encode une duree et lie-la au projet, a un dossier ou a une tache.</DialogDescription>
          </DialogHeader>
          <TimeEntryForm
            key={createFormKey}
            canRecordTime={canRecordTime}
            projectId={selectedProject?.id ?? 0}
            hours={hours}
            minutes={minutes}
            hourlyRate={hourlyRate}
            description={description}
            targetValue={targetValue}
            targetTree={targetTree}
            selectedTargetLabel={selectedTargetLabel}
            isPending={createTimeEntry.isPending}
            error={createTimeEntry.error ? getErrorMessage(createTimeEntry.error) : null}
            onHoursChange={setHours}
            onMinutesChange={setMinutes}
            onHourlyRateChange={setHourlyRateDraft}
            onDescriptionChange={setDescription}
            onTargetValueChange={setTargetValue}
            onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
            onSubmit={onSubmitTimeEntry}
          />
        </DialogContent>
      </Dialog>

      <PaymentDialog
        key={paymentTarget?.id ?? "payment-none"}
        entry={paymentTarget}
        isPending={payTimeEntry.isPending}
        error={payTimeEntry.error ? getErrorMessage(payTimeEntry.error) : null}
        onOpenChange={(open) => { if (!open) { setPaymentTarget(null); payTimeEntry.reset(); } }}
        onSubmit={(values) => payTimeEntry.mutate(values)}
      />
      <EditTimeEntryDialog
        key={editingEntry?.id ?? "none"}
        entry={editingEntry}
        projectId={selectedProject?.id ?? 0}
        targetTree={targetTree}
        isPending={updateTimeEntry.isPending}
        error={updateTimeEntry.error ? getErrorMessage(updateTimeEntry.error) : null}
        onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { if (!open) { setEditingEntry(null); updateTimeEntry.reset(); } }}
        onSubmit={(data) => updateTimeEntry.mutate(data)}
      />
      <TimeEntryDetailDialog
        entry={detailEntry}
        folderNameById={folderNameById}
        taskTitleById={taskTitleById}
        userNameById={userNameById}
        canEdit={canRecordTime}
        canPay={canPayTime}
        canDelete={canDeleteTime}
        deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
        onClose={() => setDetailEntry(null)}
        onEdit={(entry) => { setDetailEntry(null); setEditingEntry(entry); }}
        onPay={(entry) => { setDetailEntry(null); setPaymentTarget(entry); }}
        onDelete={(entry) => { setDetailEntry(null); deleteTimeEntry.mutate(entry.id); }}
      />
    </div>
  );
}
