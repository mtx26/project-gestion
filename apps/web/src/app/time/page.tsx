"use client";

import type { FolderTreeNode, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, CreditCard, Folder, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type UserFilter = "mine" | "all" | `member-${number}`;
type PaymentStatusFilter = "all" | "unpaid" | "partial" | "paid";
type PeriodPreset = "this-month" | "last-month" | "this-week" | "last-30-days" | "this-year" | "all";
type TimeViewMode = "list" | "calendar";
type TargetOption = {
  value: string;
  label: string;
  depth: number;
  type: "project" | "folder" | "task";
};
type TargetTreeNode = TargetOption & {
  children: TargetTreeNode[];
};

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
  const initialTargetValue = parseTargetFilter(searchParams.get("target")) ?? "project";
  const [targetValue, setTargetValue] = useState(initialTargetValue);
  const [timeFormOpen, setTimeFormOpen] = useState(searchParams.get("new") === "1");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const defaultHourlyRate = user?.profile?.default_hourly_rate ?? "0";
  const [hourlyRateDraft, setHourlyRateDraft] = useState<string | null>(null);
  const hourlyRate = hourlyRateDraft ?? defaultHourlyRate;
  const [description, setDescription] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<TimeEntry | null>(null);
  const [paymentMode, setPaymentMode] = useState<"full" | "partial">("full");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editHours, setEditHours] = useState("1");
  const [editMinutes, setEditMinutes] = useState("0");
  const [editHourlyRate, setEditHourlyRate] = useState("0");
  const [editDescription, setEditDescription] = useState("");
  const [editTargetValue, setEditTargetValue] = useState("project");
  const defaultUserFilter: UserFilter = canViewAllTime && canPayTime ? "all" : "mine";
  const userFilter = parseUserFilter(searchParams.get("user"), defaultUserFilter, canViewAllTime);
  const paymentStatusFilter = parsePaymentStatusFilter(searchParams.get("payment"));
  const periodPreset = parsePeriodPreset(searchParams.get("period"));
  const targetFilter = parseTargetFilter(searchParams.get("target"));
  const viewMode = parseTimeViewMode(searchParams.get("view"));
  const includeUnpaidOutsideMonth = parseBooleanParam(searchParams.get("include_unpaid"));

  const selectedUserId = getSelectedUserId(userFilter, user?.id ?? null);
  const periodRange = useMemo(() => getPeriodRange(periodPreset), [periodPreset]);
  const timeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.list(selectedProject.id, {
          userId: selectedUserId ?? "all",
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          includeUnpaid: includeUnpaidOutsideMonth,
        })
      : ["time-entries", "disabled"],
    queryFn: () => api.timeEntries.list(selectedProject!.id, {
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

  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const members = normalizeApiList(membersQuery.data);
  const targetTree = useMemo(
    () => buildTargetTree(targetTreeQuery.data ?? []),
    [targetTreeQuery.data],
  );
  const selectedTargetLabel = useMemo(() => {
    return findTargetLabel(targetTree, targetValue) ?? "Projet";
  }, [targetTree, targetValue]);
  const folderNameById = useMemo(() => {
    return collectTargetLabelsByType(targetTree, "folder");
  }, [targetTree]);
  const taskTitleById = useMemo(() => {
    return collectTargetLabelsByType(targetTree, "task");
  }, [targetTree]);
  const taskFolderById = useMemo(() => {
    return collectTaskFolderIds(targetTree);
  }, [targetTree]);
  const userNameById = useMemo(() => {
    return new Map(members.map((member) => [member.user, member.user_display_name]));
  }, [members]);
  const visibleTimeEntries = useMemo(
    () => filterTimeEntriesByPaymentStatus(filterTimeEntriesByTarget(timeEntries, targetFilter, taskFolderById), paymentStatusFilter),
    [paymentStatusFilter, targetFilter, taskFolderById, timeEntries],
  );
  const totals = summarizeTimeEntries(visibleTimeEntries);
  const targetFilterLabel = targetFilter ? findTargetLabel(targetTree, targetFilter) : null;
  const totalsLabel = getTotalsLabel(userFilter, paymentStatusFilter, periodPreset, members, user?.id ?? null, targetFilterLabel);
  const durationMinutes = Number(hours) * 60 + Number(minutes);

  const createTimeEntry = useMutation({
    mutationFn: () =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        duration_minutes: durationMinutes,
        hourly_rate: hourlyRate === "" ? undefined : hourlyRate,
        description: description.trim() || null,
        folder: getTargetPayload(targetValue).folder,
        task: getTargetPayload(targetValue).task,
      }),
    onSuccess: async () => {
      setHours("1");
      setMinutes("0");
      setHourlyRateDraft(null);
      setDescription("");
      setTargetValue("project");
      setTimeFormOpen(false);
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
  });
  const deleteTimeEntry = useMutation({
    mutationFn: (timeEntryId: number) => api.timeEntries.remove(selectedProject!.id, timeEntryId),
    onSuccess: async () => {
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
  });
  const payTimeEntry = useMutation({
    mutationFn: () =>
      api.timeEntries.pay(selectedProject!.id, paymentTarget!.id, {
        pay_full: paymentMode === "full",
        amount: paymentMode === "partial" ? paymentAmount : undefined,
      }),
    onSuccess: async () => {
      setPaymentTarget(null);
      setPaymentMode("full");
      setPaymentAmount("");
      await Promise.all([
        invalidateTimeQueries(queryClient, selectedProject!.id),
        queryClient.invalidateQueries({ queryKey: ["projects", selectedProject!.id, "financial-entries"] }),
      ]);
    },
  });
  const updateTimeEntry = useMutation({
    mutationFn: () =>
      api.timeEntries.update(selectedProject!.id, editingEntry!.id, {
        duration_minutes: Number(editHours) * 60 + Number(editMinutes),
        hourly_rate: editHourlyRate === "" ? undefined : editHourlyRate,
        description: editDescription.trim() || null,
        folder: getTargetPayload(editTargetValue).folder,
        task: getTargetPayload(editTargetValue).task,
      }),
    onSuccess: async () => {
      setEditingEntry(null);
      await invalidateTimeQueries(queryClient, selectedProject!.id);
    },
  });

  function onSubmitTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !user || !canRecordTime || durationMinutes <= 0) {
      return;
    }

    createTimeEntry.mutate();
  }

  function openPaymentDialog(entry: TimeEntry) {
    setPaymentTarget(entry);
    setPaymentMode("full");
    setPaymentAmount(entry.remaining_amount);
  }

  function openEditDialog(entry: TimeEntry) {
    setEditingEntry(entry);
    setEditHours(String(Math.floor(entry.duration_minutes / 60)));
    setEditMinutes(String(entry.duration_minutes % 60));
    setEditHourlyRate(entry.hourly_rate);
    setEditDescription(entry.description ?? "");
    setEditTargetValue(getTargetValueFromEntry(entry));
  }

  function updateUrlFilter(changes: Partial<{
    user: UserFilter;
    payment: PaymentStatusFilter;
    period: PeriodPreset;
    target: string | null;
    view: TimeViewMode;
    includeUnpaid: boolean;
  }>) {
    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));

    if (changes.user) {
      params.set("user", changes.user);
    }
    if (changes.payment) {
      params.set("payment", changes.payment);
    }
    if (changes.period) {
      params.set("period", changes.period);
    }
    if (changes.target !== undefined) {
      if (changes.target) {
        params.set("target", changes.target);
      } else {
        params.delete("target");
      }
    }
    if (changes.view) {
      params.set("view", changes.view);
    }
    if (changes.includeUnpaid !== undefined) {
      if (changes.includeUnpaid) {
        params.set("include_unpaid", "1");
      } else {
        params.delete("include_unpaid");
      }
    }

    router.replace(`/time?${params.toString()}`, { scroll: false });
  }

  function onUserFilterChange(value: UserFilter) {
    updateUrlFilter({ user: value });
  }

  function onPaymentStatusFilterChange(value: PaymentStatusFilter) {
    updateUrlFilter({ payment: value });
  }

  function onPeriodPresetChange(value: PeriodPreset) {
    updateUrlFilter({ period: value });
  }

  function onIncludeUnpaidOutsideMonthChange(value: boolean) {
    updateUrlFilter({ includeUnpaid: value });
  }

  function onViewModeChange(value: TimeViewMode) {
    updateUrlFilter({ view: value });
  }

  if (projectsQuery.isLoading) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (!selectedProject) {
    return (
      <Empty className="border bg-card p-8">
        <EmptyHeader>
          <EmptyTitle>Aucun projet actif</EmptyTitle>
          <EmptyDescription>Cree ou selectionne un projet pour enregistrer du temps.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openCreateProject}>Creer un projet</Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!canViewTime && !canRecordTime) {
    return (
      <div className="space-y-5">
        <TimePageTitle />
        <PermissionNotice
          title="Suivi du temps indisponible"
          description="Ton role ne permet pas de consulter ni d'enregistrer des heures sur ce projet."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TimePageTitle />
        {canRecordTime ? (
          <Button type="button" variant="outline" onClick={() => setTimeFormOpen(true)}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      {canViewTime && timeEntriesQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(timeEntriesQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {canViewTime ? (
        <TimePeriodToolbar
          canViewAllTime={canViewAllTime}
          members={members}
          periodPreset={periodPreset}
          paymentStatusFilter={paymentStatusFilter}
          targetFilterLabel={targetFilterLabel}
          userFilter={userFilter}
          includeUnpaidOutsideMonth={includeUnpaidOutsideMonth}
          onClearTargetFilter={() => updateUrlFilter({ target: null })}
          onPeriodPresetChange={onPeriodPresetChange}
          onPaymentStatusFilterChange={onPaymentStatusFilterChange}
          onUserFilterChange={onUserFilterChange}
          onIncludeUnpaidOutsideMonthChange={onIncludeUnpaidOutsideMonthChange}
        />
      ) : null}

      <div className={canRecordTime && canViewTime ? "grid gap-4 lg:grid-cols-[380px_1fr]" : "grid gap-4"}>
        {canRecordTime ? (
          <div className="space-y-4">
            {canViewTime ? (
              <TimeTotalsPanel
                label={totalsLabel}
                totals={totals}
              />
          ) : (
            <PermissionNotice
              title="Liste non visible"
              description="Tu peux enregistrer du temps, mais ton role ne permet pas de consulter les heures."
            />
          )}
        </div>
        ) : null}

        {canViewTime ? (
        <Card className="rounded-lg">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Entrees de temps</CardTitle>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <Button
                type="button"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("list")}
              >
                Liste
              </Button>
              <Button
                type="button"
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("calendar")}
              >
                <CalendarDays className="size-3.5" />
                Calendrier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!canViewAllTime && canViewTime ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Vue limitee a tes propres entrees.
              </p>
            ) : null}

            {viewMode === "calendar" ? (
              <TimeCalendarView
                entries={visibleTimeEntries}
                isLoading={timeEntriesQuery.isLoading}
                currentUserId={user?.id ?? null}
                userNameById={userNameById}
                folderNameById={folderNameById}
                taskTitleById={taskTitleById}
                calendarDate={periodRange.startDate}
              />
            ) : (
              <TimeEntryList
                entries={visibleTimeEntries}
                isLoading={timeEntriesQuery.isLoading}
                currentUserId={user?.id ?? null}
                userNameById={userNameById}
                folderNameById={folderNameById}
                taskTitleById={taskTitleById}
                canPay={canPayTime}
                canEdit={canRecordTime}
                canDelete={canDeleteTime}
                deletingId={deleteTimeEntry.isPending ? deleteTimeEntry.variables : null}
                onPay={openPaymentDialog}
                onEdit={openEditDialog}
                onDelete={(entry) => deleteTimeEntry.mutate(entry.id)}
              />
            )}

            {deleteTimeEntry.error ? (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{getErrorMessage(deleteTimeEntry.error)}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
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
      </div>

      <Dialog open={timeFormOpen} onOpenChange={setTimeFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle entree</DialogTitle>
            <DialogDescription>Encode une duree et lie-la au projet, a un dossier ou a une tache.</DialogDescription>
          </DialogHeader>
          <TimeEntryForm
            canRecordTime={canRecordTime}
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
            onSubmit={onSubmitTimeEntry}
          />
        </DialogContent>
      </Dialog>

      <PaymentDialog
        entry={paymentTarget}
        mode={paymentMode}
        amount={paymentAmount}
        isPending={payTimeEntry.isPending}
        error={payTimeEntry.error ? getErrorMessage(payTimeEntry.error) : null}
        onModeChange={setPaymentMode}
        onAmountChange={setPaymentAmount}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentTarget(null);
          }
        }}
        onSubmit={() => payTimeEntry.mutate()}
      />
      <EditTimeEntryDialog
        entry={editingEntry}
        hours={editHours}
        minutes={editMinutes}
        hourlyRate={editHourlyRate}
        description={editDescription}
        targetTree={targetTree}
        targetValue={editTargetValue}
        selectedTargetLabel={findTargetLabel(targetTree, editTargetValue) ?? "Projet"}
        isPending={updateTimeEntry.isPending}
        error={updateTimeEntry.error ? getErrorMessage(updateTimeEntry.error) : null}
        onHoursChange={setEditHours}
        onMinutesChange={setEditMinutes}
        onHourlyRateChange={setEditHourlyRate}
        onDescriptionChange={setEditDescription}
        onTargetValueChange={setEditTargetValue}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntry(null);
          }
        }}
        onSubmit={() => updateTimeEntry.mutate()}
      />
    </div>
  );
}

function TimePageTitle() {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">Temps</p>
      <h1 className="mt-1 text-2xl font-semibold">Suivi du travail</h1>
    </div>
  );
}

function PermissionNotice({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-5">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function TimeTotalsPanel({
  label,
  totals,
}: {
  label: string;
  totals: { durationMinutes: number; costAmount: number; remainingAmount: number };
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <CardTitle className="mt-1 text-lg">Synthese</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <TimeSummary label="Temps total" value={formatDuration(totals.durationMinutes)} />
          <TimeSummary label="Montant total" value={formatMoney(totals.costAmount)} />
          <TimeSummary label="Reste a payer" value={formatMoney(totals.remainingAmount)} />
        </div>
      </CardContent>
    </Card>
  );
}

function TimeEntryForm({
  canRecordTime,
  hours,
  minutes,
  hourlyRate,
  description,
  targetValue,
  targetTree,
  selectedTargetLabel,
  isPending,
  error,
  onHoursChange,
  onMinutesChange,
  onHourlyRateChange,
  onDescriptionChange,
  onTargetValueChange,
  onSubmit,
}: {
  canRecordTime: boolean;
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string;
  targetValue: string;
  targetTree: TargetTreeNode;
  selectedTargetLabel: string;
  isPending: boolean;
  error: string | null;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const durationMinutes = Number(hours) * 60 + Number(minutes);

  return (
    <>
      {!canRecordTime ? (
        <Alert>
          <AlertDescription>Permission time_entry.edit requise pour enregistrer du temps.</AlertDescription>
        </Alert>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="time-hours">Heures</Label>
              <Input id="time-hours" type="number" min="0" value={hours} onChange={(event) => onHoursChange(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-minutes">Minutes</Label>
              <Input id="time-minutes" type="number" min="0" max="59" value={minutes} onChange={(event) => onMinutesChange(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-rate">Taux horaire</Label>
            <Input id="time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => onHourlyRateChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Cible</Label>
            <TargetPickerDialog
              targetTree={targetTree}
              selectedValue={targetValue}
              selectedLabel={selectedTargetLabel}
              onSelect={onTargetValueChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-description">Description</Label>
            <Textarea id="time-description" rows={4} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={durationMinutes <= 0 || isPending}>
              <Clock3 className="size-4" />
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}

function TimePeriodToolbar({
  canViewAllTime,
  members,
  periodPreset,
  paymentStatusFilter,
  targetFilterLabel,
  userFilter,
  includeUnpaidOutsideMonth,
  onClearTargetFilter,
  onPeriodPresetChange,
  onPaymentStatusFilterChange,
  onUserFilterChange,
  onIncludeUnpaidOutsideMonthChange,
}: {
  canViewAllTime: boolean;
  members: Array<{ id: number; user: number; user_display_name: string }>;
  periodPreset: PeriodPreset;
  paymentStatusFilter: PaymentStatusFilter;
  targetFilterLabel: string | null;
  userFilter: UserFilter;
  includeUnpaidOutsideMonth: boolean;
  onClearTargetFilter: () => void;
  onPeriodPresetChange: (value: PeriodPreset) => void;
  onPaymentStatusFilterChange: (value: PaymentStatusFilter) => void;
  onUserFilterChange: (value: UserFilter) => void;
  onIncludeUnpaidOutsideMonthChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {canViewAllTime ? (
        <Select value={userFilter} onValueChange={(value) => onUserFilterChange(value as UserFilter)}>
          <SelectTrigger className="w-full bg-background sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">Mes heures</SelectItem>
            <SelectItem value="all">Toute l&apos;equipe</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={`member-${member.user}`}>
                {member.user_display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select value={paymentStatusFilter} onValueChange={(value) => onPaymentStatusFilterChange(value as PaymentStatusFilter)}>
        <SelectTrigger className="w-full bg-background sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="unpaid">Non paye</SelectItem>
          <SelectItem value="partial">Partiel</SelectItem>
          <SelectItem value="paid">Paye</SelectItem>
        </SelectContent>
      </Select>
      <Select value={periodPreset} onValueChange={(value) => onPeriodPresetChange(value as PeriodPreset)}>
        <SelectTrigger className="w-full bg-background sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-week">Cette semaine</SelectItem>
          <SelectItem value="this-month">Ce mois</SelectItem>
          <SelectItem value="last-month">Mois dernier</SelectItem>
          <SelectItem value="last-30-days">30 derniers jours</SelectItem>
          <SelectItem value="this-year">Cette annee</SelectItem>
          <SelectItem value="all">Tout</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={includeUnpaidOutsideMonth ? "default" : "outline"}
        className="sm:w-auto"
        onClick={() => onIncludeUnpaidOutsideMonthChange(!includeUnpaidOutsideMonth)}
      >
        Impayes inclus
      </Button>
      {targetFilterLabel ? (
        <Button type="button" variant="secondary" className="sm:w-auto" onClick={onClearTargetFilter}>
          <Folder className="size-4" />
          {targetFilterLabel}
        </Button>
      ) : null}
    </div>
  );
}

function TimeEntryList({
  entries,
  isLoading,
  currentUserId,
  userNameById,
  folderNameById,
  taskTitleById,
  canPay,
  canEdit,
  canDelete,
  deletingId,
  onPay,
  onEdit,
  onDelete,
}: {
  entries: TimeEntry[];
  isLoading: boolean;
  currentUserId: number | null;
  userNameById: Map<number, string>;
  folderNameById: Map<number, string>;
  taskTitleById: Map<number, string>;
  canPay: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  onPay: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="border p-8">
        <EmptyHeader>
          <EmptyTitle>Aucune entree</EmptyTitle>
          <EmptyDescription>Aucun temps enregistre pour cette vue.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <TimeEntryRow
          key={entry.id}
          entry={entry}
          displayName={userNameById.get(entry.user) ?? (entry.user === currentUserId ? "Toi" : `Utilisateur ${entry.user}`)}
          targetLabel={getEntryTargetLabel(entry, folderNameById, taskTitleById)}
          canPay={canPay}
          canEdit={canEdit}
          canDelete={canDelete}
          isDeleting={deletingId === entry.id}
          onPay={() => onPay(entry)}
          onEdit={() => onEdit(entry)}
          onDelete={() => onDelete(entry)}
        />
      ))}
    </div>
  );
}

function TimeCalendarView({
  entries,
  isLoading,
  currentUserId,
  userNameById,
  folderNameById,
  taskTitleById,
  calendarDate,
}: {
  entries: TimeEntry[];
  isLoading: boolean;
  currentUserId: number | null;
  userNameById: Map<number, string>;
  folderNameById: Map<number, string>;
  taskTitleById: Map<number, string>;
  calendarDate?: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-7 gap-0 rounded-lg border bg-card">
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton key={index} className="m-2 h-28 rounded-md" />
        ))}
      </div>
    );
  }

  const monthDate = getCalendarMonthDate(calendarDate, entries);
  const days = getMonthCalendarDays(monthDate);
  const entriesByDay = groupTimeEntriesByDay(entries);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <p className="font-medium">{formatCalendarMonth(monthDate)}</p>
          <p className="text-xs text-muted-foreground">{entries.length} entree{entries.length > 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="border-r p-2 last:border-r-0">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dateKey = formatDateInputValue(day);
          const dayEntries = entriesByDay.get(dateKey) ?? [];
          const dayTotals = summarizeTimeEntries(dayEntries);
          const isOutsideMonth = day.getMonth() !== monthDate.getMonth();

          return (
            <div
              key={`${dateKey}-${index}`}
              className={`min-h-36 border-r border-b p-2 ${index % 7 === 6 ? "border-r-0" : ""} ${isOutsideMonth ? "bg-muted/20 text-muted-foreground" : "bg-card"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{day.getDate()}</span>
                {dayEntries.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{formatDuration(dayTotals.durationMinutes)}</span>
                ) : null}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{entry.description || getEntryTargetLabel(entry, folderNameById, taskTitleById)}</span>
                      <span className="shrink-0">{formatTimeOnly(entry.created_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {userNameById.get(entry.user) ?? (entry.user === currentUserId ? "Toi" : `Utilisateur ${entry.user}`)}
                    </div>
                  </div>
                ))}
                {dayEntries.length > 4 ? (
                  <p className="text-xs text-muted-foreground">+ {dayEntries.length - 4} autres</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TargetPickerDialog({
  targetTree,
  selectedValue,
  selectedLabel,
  onSelect,
}: {
  targetTree: TargetTreeNode;
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set(["project"]));

  function toggleNode(value: string) {
    setExpandedValues((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function selectTarget(value: string) {
    onSelect(value);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 w-full justify-start gap-2 px-3 py-2"
        onClick={() => setOpen(true)}
      >
        <TargetIcon type={getTargetTypeFromValue(selectedValue)} />
        <span className="min-w-0 truncate">{selectedLabel}</span>
      </Button>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choisir une cible</DialogTitle>
          <DialogDescription>
            Parcours les dossiers et selectionne un dossier ou une tache.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[56vh] overflow-y-auto rounded-md border bg-background p-2">
          <TargetTreeRow
            node={targetTree}
            selectedValue={selectedValue}
            expandedValues={expandedValues}
            onToggle={toggleNode}
            onSelect={selectTarget}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fermer
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetTreeRow({
  node,
  selectedValue,
  expandedValues,
  onToggle,
  onSelect,
}: {
  node: TargetTreeNode;
  selectedValue: string;
  expandedValues: Set<string>;
  onToggle: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const isExpanded = expandedValues.has(node.value);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedValue === node.value;

  return (
    <div>
      <div
        className="grid h-9 grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md pr-2 hover:bg-muted/70"
        style={{ paddingLeft: `${node.depth * 22}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isExpanded ? "Replier" : "Deplier"}
            onClick={() => onToggle(node.value)}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-6" />
        )}

        <button
          type="button"
          className={`flex min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left ${
            isSelected ? "bg-primary/10 text-primary" : ""
          }`}
          onClick={() => onSelect(node.value)}
        >
          <TargetIcon type={node.type} />
          <span className="min-w-0 truncate">{node.label}</span>
          {node.type === "task" ? (
            <Badge variant="outline" className="ml-auto shrink-0 border-sky-200 bg-sky-50 text-sky-700">
              Tache
            </Badge>
          ) : null}
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <TargetTreeRow
              key={child.value}
              node={child}
              selectedValue={selectedValue}
              expandedValues={expandedValues}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TargetIcon({ type }: { type: TargetTreeNode["type"] }) {
  if (type === "task") {
    return <ListTodo className="size-4 shrink-0 text-sky-600" />;
  }
  if (type === "folder") {
    return <Folder className="size-4 shrink-0 text-amber-500" />;
  }
  return <Clock3 className="size-4 shrink-0 text-primary" />;
}

function TimeEntryRow({
  entry,
  displayName,
  targetLabel,
  canPay,
  canEdit,
  canDelete,
  isDeleting,
  onPay,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  displayName: string;
  targetLabel: string;
  canPay: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const paymentStatus = getPaymentStatus(entry);
  const targetType = entry.task != null ? "task" : entry.folder != null ? "folder" : "project";
  const paidRatio = Number(entry.cost_amount) > 0 ? Math.min(100, (Number(entry.paid_amount) / Number(entry.cost_amount)) * 100) : 100;

  return (
    <div className={getTimeEntryCardClassName(paymentStatus)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getPaymentBadgeClassName(paymentStatus)}>
              {getPaymentStatusLabel(paymentStatus)}
            </Badge>
            <p className="min-w-0 font-medium">{entry.description || "Temps enregistre"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{displayName}</span>
            <span>{formatDateTime(entry.created_at)}</span>
            <span className="inline-flex max-w-full items-center gap-1">
              <TargetIcon type={targetType} />
              <span className="min-w-0 truncate">{targetLabel}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <TimeEntryMetric value={formatDuration(entry.duration_minutes)} />
            <TimeEntryMetric value={`${formatMoney(entry.hourly_rate)}/h`} />
            <TimeEntryMetric value={`Total ${formatMoney(entry.cost_amount)}`} />
            {paymentStatus === "paid" ? (
              <TimeEntryMetric value="Solde OK" tone="paid" />
            ) : (
              <TimeEntryMetric value={`Reste ${formatMoney(entry.remaining_amount)}`} tone="unpaid" />
            )}
          </div>
          {paymentStatus !== "paid" ? (
            <div className="flex max-w-sm items-center gap-2">
              <Progress value={paidRatio} className="h-1.5" />
              <span className="shrink-0 text-xs text-muted-foreground">{Math.round(paidRatio)}%</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 xl:justify-end">
          {Number(entry.paid_amount) > 0 ? (
            <span className="text-xs text-muted-foreground">{formatMoney(entry.paid_amount)} paye</span>
          ) : null}
          {canPay && !entry.is_paid ? (
            <Button type="button" variant="outline" size="sm" onClick={onPay}>
              <CreditCard className="size-4" />
              Payer
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifier cette entree" onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer cette entree" disabled={isDeleting} onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EditTimeEntryDialog({
  entry,
  hours,
  minutes,
  hourlyRate,
  description,
  targetTree,
  targetValue,
  selectedTargetLabel,
  isPending,
  error,
  onHoursChange,
  onMinutesChange,
  onHourlyRateChange,
  onDescriptionChange,
  onTargetValueChange,
  onOpenChange,
  onSubmit,
}: {
  entry: TimeEntry | null;
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string;
  targetTree: TargetTreeNode;
  targetValue: string;
  selectedTargetLabel: string;
  isPending: boolean;
  error: string | null;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const durationMinutes = Number(hours) * 60 + Number(minutes);

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;entree</DialogTitle>
          <DialogDescription>
            Ajuste la duree, le taux, la cible ou la description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-time-hours">Heures</Label>
              <Input id="edit-time-hours" type="number" min="0" value={hours} onChange={(event) => onHoursChange(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time-minutes">Minutes</Label>
              <Input id="edit-time-minutes" type="number" min="0" max="59" value={minutes} onChange={(event) => onMinutesChange(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-time-rate">Taux horaire</Label>
            <Input id="edit-time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => onHourlyRateChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Cible</Label>
            <TargetPickerDialog
              targetTree={targetTree}
              selectedValue={targetValue}
              selectedLabel={selectedTargetLabel}
              onSelect={onTargetValueChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-time-description">Description</Label>
            <Textarea id="edit-time-description" rows={4} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="button" disabled={durationMinutes <= 0 || isPending} onClick={onSubmit}>
            <Pencil className="size-4" />
            {isPending ? "Modification..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  entry,
  mode,
  amount,
  isPending,
  error,
  onModeChange,
  onAmountChange,
  onOpenChange,
  onSubmit,
}: {
  entry: TimeEntry | null;
  mode: "full" | "partial";
  amount: string;
  isPending: boolean;
  error: string | null;
  onModeChange: (mode: "full" | "partial") => void;
  onAmountChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const remainingAmount = Number(entry?.remaining_amount ?? 0);

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer comme paye</DialogTitle>
          <DialogDescription>
            Reste a payer : {formatMoney(remainingAmount)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={mode} onValueChange={(value) => onModeChange(value as "full" | "partial")}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Payer le reste complet</SelectItem>
              <SelectItem value="partial">Paiement partiel</SelectItem>
            </SelectContent>
          </Select>

          {mode === "partial" ? (
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Montant paye</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                max={remainingAmount}
                step="0.01"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isPending || remainingAmount <= 0 || (mode === "partial" && Number(amount) <= 0)}
            onClick={onSubmit}
          >
            <CheckCircle2 className="size-4" />
            {isPending ? "Paiement..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function TimeEntryMetric({ value, tone = "default" }: { value: string; tone?: "default" | "paid" | "unpaid" }) {
  const toneClassName = tone === "paid"
    ? "text-emerald-700"
    : tone === "unpaid"
      ? "text-orange-700"
      : "text-foreground";

  return (
    <span className={`font-medium ${toneClassName}`}>{value}</span>
  );
}

function buildTimeHref(projectId: number, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("project", String(projectId));
  return `/time?${params.toString()}`;
}

function parseUserFilter(value: string | null, fallback: UserFilter, canViewAllTime: boolean): UserFilter {
  if (value === "all" && canViewAllTime) {
    return "all";
  }
  if (value?.startsWith("member-") && canViewAllTime) {
    const userId = Number(value.replace("member-", ""));
    return Number.isFinite(userId) && userId > 0 ? `member-${userId}` : fallback;
  }
  if (value === "mine") {
    return "mine";
  }
  return fallback;
}

function parsePaymentStatusFilter(value: string | null): PaymentStatusFilter {
  if (value === "unpaid" || value === "partial" || value === "paid") {
    return value;
  }
  return "all";
}

function parsePeriodPreset(value: string | null): PeriodPreset {
  if (
    value === "this-month" ||
    value === "last-month" ||
    value === "this-week" ||
    value === "last-30-days" ||
    value === "this-year" ||
    value === "all"
  ) {
    return value;
  }
  return "this-month";
}

function parseTimeViewMode(value: string | null): TimeViewMode {
  return value === "calendar" ? "calendar" : "list";
}

function parseTargetFilter(value: string | null) {
  if (value === "project") {
    return "project";
  }
  if (value?.startsWith("folder-")) {
    const id = Number(value.replace("folder-", ""));
    return Number.isFinite(id) && id > 0 ? `folder-${id}` : null;
  }
  if (value?.startsWith("task-")) {
    const id = Number(value.replace("task-", ""));
    return Number.isFinite(id) && id > 0 ? `task-${id}` : null;
  }
  return null;
}

function parseBooleanParam(value: string | null) {
  return value === "1" || value === "true";
}

function getPeriodRange(period: PeriodPreset): { startDate?: string; endDate?: string } {
  const now = new Date();

  if (period === "all") {
    return {};
  }

  if (period === "this-week") {
    const dayOffset = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    return { startDate: formatDateInputValue(start), endDate: formatDateInputValue(now) };
  }

  if (period === "last-30-days") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { startDate: formatDateInputValue(start), endDate: formatDateInputValue(now) };
  }

  if (period === "this-year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: formatDateInputValue(start), endDate: formatDateInputValue(now) };
  }

  const monthOffset = period === "last-month" ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);

  return {
    startDate: formatDateInputValue(start),
    endDate: formatDateInputValue(end),
  };
}

function formatDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getSelectedUserId(filter: UserFilter, currentUserId: number | null) {
  if (filter === "all") {
    return null;
  }
  if (filter === "mine") {
    return currentUserId;
  }
  return Number(filter.replace("member-", ""));
}

function filterTimeEntriesByPaymentStatus(entries: TimeEntry[], filter: PaymentStatusFilter) {
  if (filter === "all") {
    return entries;
  }

  return entries.filter((entry) => getPaymentStatus(entry) === filter);
}

function filterTimeEntriesByTarget(entries: TimeEntry[], target: string | null, taskFolderById: Map<number, number>) {
  if (!target) {
    return entries;
  }

  if (target === "project") {
    return entries.filter((entry) => entry.folder == null && entry.task == null);
  }

  if (target.startsWith("folder-")) {
    const folderId = Number(target.replace("folder-", ""));
    return entries.filter((entry) => entry.folder === folderId || (entry.task != null && taskFolderById.get(entry.task) === folderId));
  }

  if (target.startsWith("task-")) {
    const taskId = Number(target.replace("task-", ""));
    return entries.filter((entry) => entry.task === taskId);
  }

  return entries;
}

function getPaymentStatus(entry: TimeEntry): Exclude<PaymentStatusFilter, "all"> {
  if (entry.is_paid || Number(entry.remaining_amount) <= 0) {
    return "paid";
  }

  if (Number(entry.paid_amount) > 0) {
    return "partial";
  }

  return "unpaid";
}

function getPaymentStatusLabel(status: Exclude<PaymentStatusFilter, "all">) {
  if (status === "paid") {
    return "Paye";
  }
  if (status === "partial") {
    return "Partiel";
  }
  return "A payer";
}

function getPaymentBadgeClassName(status: Exclude<PaymentStatusFilter, "all">) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function getTimeEntryCardClassName(status: Exclude<PaymentStatusFilter, "all">) {
  const baseClassName = "rounded-md border bg-card p-4 text-sm";
  if (status === "paid") {
    return `${baseClassName} border-l-4 border-l-emerald-500`;
  }
  if (status === "partial") {
    return `${baseClassName} border-l-4 border-l-amber-500`;
  }
  return `${baseClassName} border-l-4 border-l-orange-500`;
}

function getTotalsLabel(
  userFilter: UserFilter,
  paymentStatusFilter: PaymentStatusFilter,
  periodPreset: PeriodPreset,
  members: Array<{ user: number; user_display_name: string }>,
  currentUserId: number | null,
  targetLabel: string | null,
) {
  const userLabel = userFilter === "all"
    ? "toute l'equipe"
    : userFilter === "mine"
      ? "mes heures"
      : members.find((member) => member.user === getSelectedUserId(userFilter, currentUserId))?.user_display_name ?? "membre";
  const statusLabel = paymentStatusFilter === "all" ? "tous statuts" : getPaymentStatusLabel(paymentStatusFilter).toLowerCase();
  const periodLabel = getPeriodLabel(periodPreset).toLowerCase();
  const targetSuffix = targetLabel ? ` - ${targetLabel}` : "";

  return `Totaux - ${userLabel} - ${periodLabel} - ${statusLabel}${targetSuffix}`;
}

function getPeriodLabel(period: PeriodPreset) {
  if (period === "this-week") {
    return "Cette semaine";
  }
  if (period === "this-month") {
    return "Ce mois";
  }
  if (period === "last-month") {
    return "Mois dernier";
  }
  if (period === "last-30-days") {
    return "30 derniers jours";
  }
  if (period === "this-year") {
    return "Cette annee";
  }
  return "Toute la periode";
}

function getTargetPayload(value: string) {
  if (value.startsWith("folder-")) {
    return { folder: Number(value.replace("folder-", "")), task: null };
  }
  if (value.startsWith("task-")) {
    return { folder: null, task: Number(value.replace("task-", "")) };
  }
  return { folder: null, task: null };
}

function getTargetValueFromEntry(entry: Pick<TimeEntry, "folder" | "task">) {
  if (entry.task != null) {
    return `task-${entry.task}`;
  }
  if (entry.folder != null) {
    return `folder-${entry.folder}`;
  }
  return "project";
}

function buildTargetTree(nodes: FolderTreeNode[]): TargetTreeNode {
  const root: TargetTreeNode = {
    value: "project",
    label: "Projet",
    depth: 0,
    type: "project",
    children: [],
  };

  root.children.push(...buildFolderTargetTree(nodes, 1));
  return root;
}

function buildFolderTargetTree(nodes: FolderTreeNode[], depth: number) {
  const result: TargetTreeNode[] = [];

  for (const node of nodes) {
    if (node.type !== "folder" && node.type !== "task") {
      continue;
    }

    result.push({
      value: `${node.type}-${node.id}`,
      label: node.name,
      depth,
      type: node.type,
      children: node.type === "folder" ? buildFolderTargetTree(node.children ?? [], depth + 1) : [],
    });
  }

  return result;
}

function findTargetLabel(node: TargetTreeNode, value: string): string | null {
  if (node.value === value) {
    return node.label;
  }

  for (const child of node.children) {
    const label = findTargetLabel(child, value);
    if (label) {
      return label;
    }
  }

  return null;
}

function getTargetTypeFromValue(value: string): TargetTreeNode["type"] {
  if (value.startsWith("task-")) {
    return "task";
  }
  if (value.startsWith("folder-")) {
    return "folder";
  }
  return "project";
}

function collectTargetLabelsByType(node: TargetTreeNode, type: "folder" | "task") {
  const labels = new Map<number, string>();
  collectTargetLabelsByTypeInPlace(node, type, labels);
  return labels;
}

function collectTargetLabelsByTypeInPlace(
  node: TargetTreeNode,
  type: "folder" | "task",
  labels: Map<number, string>,
) {
  if (node.type === type) {
    labels.set(Number(node.value.replace(`${type}-`, "")), node.label);
  }

  for (const child of node.children) {
    collectTargetLabelsByTypeInPlace(child, type, labels);
  }
}

function collectTaskFolderIds(node: TargetTreeNode) {
  const taskFolderIds = new Map<number, number>();
  collectTaskFolderIdsInPlace(node, null, taskFolderIds);
  return taskFolderIds;
}

function collectTaskFolderIdsInPlace(
  node: TargetTreeNode,
  currentFolderId: number | null,
  taskFolderIds: Map<number, number>,
) {
  const folderId = node.type === "folder" ? Number(node.value.replace("folder-", "")) : currentFolderId;

  if (node.type === "task" && folderId != null) {
    taskFolderIds.set(Number(node.value.replace("task-", "")), folderId);
  }

  for (const child of node.children) {
    collectTaskFolderIdsInPlace(child, folderId, taskFolderIds);
  }
}

function getEntryTargetLabel(
  entry: TimeEntry,
  folderNameById: Map<number, string>,
  taskTitleById: Map<number, string>,
) {
  if (entry.task != null) {
    return taskTitleById.get(entry.task) ?? `#${entry.task}`;
  }
  if (entry.folder != null) {
    return folderNameById.get(entry.folder) ?? `#${entry.folder}`;
  }
  return "Projet";
}

function summarizeTimeEntries(entries: TimeEntry[]) {
  return entries.reduce(
    (total, entry) => ({
      durationMinutes: total.durationMinutes + entry.duration_minutes,
      costAmount: total.costAmount + Number(entry.cost_amount),
      remainingAmount: total.remainingAmount + Number(entry.remaining_amount),
    }),
    { durationMinutes: 0, costAmount: 0, remainingAmount: 0 },
  );
}

function groupTimeEntriesByDay(entries: TimeEntry[]) {
  const groups = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const key = formatDateInputValue(new Date(entry.created_at));
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  for (const [key, dayEntries] of groups.entries()) {
    groups.set(key, dayEntries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }

  return groups;
}

function getCalendarMonthDate(dateValue: string | undefined, entries: TimeEntry[]) {
  if (dateValue) {
    return new Date(`${dateValue}T12:00:00`);
  }
  if (entries[0]) {
    return new Date(entries[0].created_at);
  }
  return new Date();
}

function getMonthCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

async function invalidateTimeQueries(
  queryClient: ProjectWorkspaceState["queryClient"],
  projectId: number,
) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "time-entries"] });
}

function formatDuration(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatMoney(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);

  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCalendarMonth(value: Date) {
  return new Intl.DateTimeFormat("fr-BE", {
    month: "long",
    year: "numeric",
  }).format(value);
}
