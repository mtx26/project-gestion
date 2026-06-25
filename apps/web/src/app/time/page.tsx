"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Lock, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { getDescendantFolderIds } from "@/lib/folder-utils";
import {
  buildTargetTree,
  collectTaskFolderIds,
  findTargetLabel,
  getTargetPayload,
} from "@/lib/target-utils";
import { parseBooleanParam } from "@/lib/url-params";
import { useProjectResources } from "@/lib/use-project-resources";
import { useUrlFilter } from "@/lib/use-url-filter";
import { TimeSummary, TimeTotalsPanel } from "./components/time-totals-panel";
import { TimeEntryForm } from "./components/time-entry-form";
import { TimeEntryList } from "./components/time-entry-list";
import { TimePeriodToolbar } from "./components/time-period-toolbar";
import { type EditTimeSubmitData, EditTimeEntryDialog, PaymentDialog, TimeEntryDetailDialog } from "./components/time-dialogs";
import {
  type PaymentStatusFilter,
  type PeriodPreset,
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
}: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const projectId = selectedProject?.id ?? null;
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
  const [viewingEntry, setViewingEntry] = useState<TimeEntry | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const updateUrlFilter = useUrlFilter("/time", searchParams, projectId);
  const { folders, targetFolders, members, handleCreateFolder } = useProjectResources(projectId, {
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

  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const targetTree = useMemo(() => buildTargetTree(targetFolders), [targetFolders]);
  const selectedTargetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);
  const taskFolderById = useMemo(() => collectTaskFolderIds(targetTree), [targetTree]);
  const userNameById = useMemo(
    () => new Map(members.map((m): [number, string] => [m.user, m.user_display_name])),
    [members],
  );
  const descendantFolderIds = useMemo(() => {
    if (!targetFilter?.startsWith("folder-")) return null;
    return getDescendantFolderIds(folders, Number(targetFilter.replace("folder-", "")));
  }, [folders, targetFilter]);
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

  async function handleTaskClick(taskId: number) {
    if (!projectId) return;
    try {
      const task = await api.tasks.get(projectId, taskId);
      setViewingTask(task);
    } catch {
      toast.error("Impossible de charger la tache");
    }
  }

  function onSubmitTimeEntry(event: React.FormEvent<HTMLFormElement>, documentIds: number[]) {
    event.preventDefault();
    if (!selectedProject || !user || !canRecordTime) return;
    createTimeEntry.mutate(documentIds);
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
          <Button type="button" className="gap-2" onClick={() => { setCreateFormKey(k => k + 1); setTimeFormOpen(true); }}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      <FormErrorAlert error={canViewTime ? getErrorMessage(timeEntriesQuery.error) : null} />

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
          folders={folders}
          onSelectFolder={(folderId) => updateUrlFilter({ target: folderId == null ? null : `folder-${folderId}` })}
          onPeriodPresetChange={(v) => updateUrlFilter({ period: v })}
          onPaymentStatusFilterChange={(v) => updateUrlFilter({ payment: v })}
          onUserFilterChange={(v) => updateUrlFilter({ user: v })}
          onIncludeUnpaidOutsideMonthChange={(v) => updateUrlFilter({ include_unpaid: v })}
          onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        />
      ) : null}

      <div className={canRecordTime && canViewTime ? "grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start" : "grid gap-4"}>
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
                entries={visibleTimeEntries}
                isLoading={timeEntriesQuery.isLoading}
                canPay={canPayTime}
                canEdit={canRecordTime}
                canDelete={canDeleteTime}
                deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
                onPay={setPaymentTarget}
                onEdit={setEditingEntry}
                onDetail={setViewingEntry}
                onDelete={(entry) => deleteTimeEntry.mutate(entry.id)}
              />
            </CardContent>
          </Card>
        ) : null}

        {canRecordTime && canViewTime ? (
          <TimeTotalsPanel
            label={totalsLabel}
            totals={totals}
            entries={visibleTimeEntries}
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
            error={getErrorMessage(createTimeEntry.error)}
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
        error={getErrorMessage(payTimeEntry.error)}
        onOpenChange={(open) => { if (!open) { setPaymentTarget(null); payTimeEntry.reset(); } }}
        onSubmit={(values) => payTimeEntry.mutate(values)}
      />
      <EditTimeEntryDialog
        key={editingEntry?.id ?? "none"}
        entry={editingEntry}
        projectId={selectedProject?.id ?? 0}
        targetTree={targetTree}
        isPending={updateTimeEntry.isPending}
        error={getErrorMessage(updateTimeEntry.error)}
        onCreateFolder={canRecordTime ? handleCreateFolder : undefined}
        onOpenChange={(open) => { if (!open) { setEditingEntry(null); updateTimeEntry.reset(); } }}
        onSubmit={(data) => updateTimeEntry.mutate(data)}
      />
      <TimeEntryDetailDialog
        entry={viewingEntry}
        canEdit={canRecordTime}
        canPay={canPayTime}
        canDelete={canDeleteTime}
        deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
        onClose={() => setViewingEntry(null)}
        onEdit={(entry) => { setViewingEntry(null); setEditingEntry(entry); }}
        onPay={(entry) => { setViewingEntry(null); setPaymentTarget(entry); }}
        onDelete={(entry) => { setViewingEntry(null); deleteTimeEntry.mutate(entry.id); }}
        onTaskClick={(taskId) => { setViewingEntry(null); handleTaskClick(taskId); }}
      />
      <TaskDetailModal
        task={viewingTask}
        members={members}
        canEdit={false}
        canDelete={false}
        onClose={() => setViewingTask(null)}
      />
    </div>
  );
}
