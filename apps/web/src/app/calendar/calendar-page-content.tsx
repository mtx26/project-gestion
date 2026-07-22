"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Link as LinkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { ProjectAccessGate } from "@/components/states/project-access-gate";
import { PageTitle } from "@/components/page-title";
import { MutedInfoCard } from "@/components/muted-info-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { DocumentPreviewDialog } from "@/components/dialogs/document-preview-dialog";
import { TimeEntryDetailModal } from "@/app/time/components/time-dialogs";
import { api } from "@/lib/api";
import { CalendarSubscriptionDialog } from "./components/calendar-subscription-dialog";
import { getMonthCalendarDays } from "./lib/calendar-utils";
import { toIsoDateString } from "@/lib/period-utils";
import type { EntryTarget } from "@/lib/target-utils";
import { buildProjectHref } from "@/lib/url-params";
import { useDocumentPreview } from "@/lib/use-document-preview";
import { useProjectPermissions } from "@/lib/use-project-permissions";

const ProjectCalendarView = dynamic(
  () => import("./components/project-calendar-view").then((m) => m.ProjectCalendarView),
  { ssr: false, loading: () => <Skeleton className="h-150 rounded-lg" /> },
);


export function CalendarPageContent() {
  return (
    <ProjectWorkspaceShell>
      {(state) => <CalendarView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function CalendarView({ user, selectedProject, projectsQuery, openCreateProject }: ProjectWorkspaceState) {
  const router = useRouter();
  const projectId = selectedProject?.id ?? null;
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewFiles = can(permissionCodes.fileView);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [showTasks, setShowTasks] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const calendarDays = useMemo(() => getMonthCalendarDays(monthDate), [monthDate]);
  const firstCalStr = useMemo(() => toIsoDateString(calendarDays[0]!), [calendarDays]);
  const lastCalStr = useMemo(() => toIsoDateString(calendarDays[calendarDays.length - 1]!), [calendarDays]);

  const includeTasks = canViewTasks && showTasks;
  const includeTime = canViewTime && showTime;

  const calendarQuery = useQuery({
    queryKey: projectId && (canViewTasks || canViewTime)
      ? queryKeys.calendar.get(projectId, firstCalStr, lastCalStr, { includeTasks, includeTime })
      : queryKeys.disabled(),
    queryFn: () =>
      api.calendar.get(projectId!, {
        start_date: firstCalStr,
        end_date: lastCalStr,
        include_tasks: includeTasks,
        include_time: includeTime,
      }),
    enabled: Boolean(projectId && (canViewTasks || canViewTime)),
  });

  const events = calendarQuery.data?.events ?? [];

  async function handleTaskClick(taskId: number) {
    if (!projectId) return;
    try {
      const task = await api.tasks.get(projectId, taskId);
      setSelectedTask(task);
    } catch {
      // task not found or no permission
    }
  }

  async function handleTimeClick(timeEntryId: number) {
    if (!projectId) return;
    try {
      const entry = await api.timeEntries.get(projectId, timeEntryId);
      setSelectedTimeEntry(entry);
    } catch {
      // entry not found or no permission
    }
  }

  async function handleTimeEntryTargetClick(target: EntryTarget) {
    if (!projectId) return;
    setSelectedTimeEntry(null);
    if (target.type === "folder") {
      router.push(buildProjectHref("/files", projectId));
      return;
    }
    try {
      const task = await api.tasks.get(projectId, target.id);
      setSelectedTask(task);
    } catch {
      // task not found or no permission
    }
  }

  if (projectsQuery.isLoading || !selectedProject || (!canViewTasks && !canViewTime)) {
    return (
      <ProjectAccessGate
        isLoadingProjects={projectsQuery.isLoading}
        hasProject={Boolean(selectedProject)}
        hasAccess={canViewTasks || canViewTime}
        icon={CalendarDays}
        noProjectDescription="Cree ou selectionne un projet pour voir le calendrier."
        accessDeniedDescription="Ton role ne permet pas de voir le calendrier de ce projet."
        onCreateProject={openCreateProject}
      />
    );
  }

  const isLoading = calendarQuery.isLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle category="Calendrier" title="Vue mensuelle" />
        <div className="flex items-center gap-5">
          <Button type="button" onClick={() => setSubscriptionDialogOpen(true)}>
            <LinkIcon className="size-4" />
            S&apos;abonner au calendrier
          </Button>
          <div className="hidden items-center gap-5 md:flex">
            {canViewTasks ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-tasks"
                  checked={showTasks}
                  onCheckedChange={(v) => setShowTasks(Boolean(v))}
                />
                <Label htmlFor="show-tasks" className="cursor-pointer text-sm font-normal">Taches</Label>
              </div>
            ) : null}
            {canViewTime ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-time"
                  checked={showTime}
                  onCheckedChange={(v) => setShowTime(Boolean(v))}
                />
                <Label htmlFor="show-time" className="cursor-pointer text-sm font-normal">Temps</Label>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <ProjectCalendarView
          events={events}
          isLoading={isLoading}
          onDatesChange={(start) => setMonthDate(new Date(start.getFullYear(), start.getMonth(), 1))}
          onTaskClick={handleTaskClick}
          onTimeClick={handleTimeClick}
        />
      </div>

      <MutedInfoCard className="flex flex-col items-center gap-2 border-dashed py-8 text-center md:hidden">
        <CalendarDays className="size-8 text-muted-foreground" />
        <p className="font-medium">Le calendrier n&apos;est pas disponible sur mobile</p>
        <p className="text-sm text-muted-foreground">
          Abonne-toi ci-dessus pour le retrouver dans ton application de calendrier
          (Google Calendar, Outlook, Apple Calendar...).
        </p>
      </MutedInfoCard>

      <TaskDetailModal
        task={selectedTask}
        projectId={projectId ?? 0}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setSelectedTask(null)}
      />

      <TimeEntryDetailModal
        entry={selectedTimeEntry}
        projectId={projectId ?? 0}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setSelectedTimeEntry(null)}
        canViewTaskTarget={canViewTasks}
        canViewFolderTarget={canViewFiles}
        onTargetClick={handleTimeEntryTargetClick}
      />

      <DocumentPreviewDialog
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      <CalendarSubscriptionDialog
        projectId={projectId ?? 0}
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        canViewTasks={canViewTasks}
        canViewTime={canViewTime}
      />
    </div>
  );
}
