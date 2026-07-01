"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { DocumentPreviewModal } from "@/components/dialogs/document-preview-modal";
import { TimeEntryDetailDialog } from "@/app/time/components/time-dialogs";
import { api } from "@/lib/api";
import { buildProjectHref } from "@/lib/url-params";
import { formatDateInputValue, getMonthCalendarDays } from "@/lib/calendar-utils";
import { useDocumentPreview } from "@/lib/use-document-preview";

const ProjectCalendarView = dynamic(
  () => import("./components/project-calendar-view").then((m) => m.ProjectCalendarView),
  { ssr: false, loading: () => <Skeleton className="h-150 rounded-lg" /> },
);


function getMonthRange(monthDate: Date): { startDate: string; endDate: string } {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { startDate: formatDateInputValue(first), endDate: formatDateInputValue(last) };
}

export function ProjectCalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="calendar"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/calendar", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/calendar", project.id, searchParams))}
    >
      {(state) => <ProjectCalendarContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectCalendarContent({ user, selectedProject, projectsQuery, openCreateProject }: ProjectWorkspaceState) {
  const projectId = selectedProject?.id ?? null;
  const canViewTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryView);
  const canViewTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskView);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [showTasks, setShowTasks] = useState(true);
  const [showTime, setShowTime] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const monthRange = useMemo(() => getMonthRange(monthDate), [monthDate]);
  const calendarDays = useMemo(() => getMonthCalendarDays(monthDate), [monthDate]);
  const firstCalStr = useMemo(() => formatDateInputValue(calendarDays[0]!), [calendarDays]);
  const lastCalStr = useMemo(() => formatDateInputValue(calendarDays[calendarDays.length - 1]!), [calendarDays]);

  const timeEntriesQuery = useQuery({
    queryKey: projectId && canViewTime
      ? queryKeys.timeEntries.list(projectId, { startDate: monthRange.startDate, endDate: monthRange.endDate })
      : ["calendar", "time", "disabled"],
    queryFn: () => api.timeEntries.list(projectId!, { start_date: monthRange.startDate, end_date: monthRange.endDate }),
    enabled: Boolean(projectId && canViewTime),
  });

  const tasksQuery = useQuery({
    queryKey: projectId && canViewTasks
      ? queryKeys.tasks.calendar(projectId, firstCalStr, lastCalStr)
      : ["calendar", "tasks", "disabled"],
    queryFn: () => api.tasks.list(projectId!, { date_from: firstCalStr, date_to: lastCalStr }),
    enabled: Boolean(projectId && canViewTasks),
  });


  const timeEntries = normalizeApiList(timeEntriesQuery.data);
  const tasks = normalizeApiList(tasksQuery.data);


  function handleTaskClick(taskId: number) {
    setSelectedTask(tasks.find((t) => t.id === taskId) ?? null);
  }

  function handleTimeClick(timeEntryId: number) {
    setSelectedTimeEntry(timeEntries.find((e) => e.id === timeEntryId) ?? null);
  }

  async function handleTimeEntryTaskClick(taskId: number) {
    if (!projectId) return;
    setSelectedTimeEntry(null);
    try {
      const task = await api.tasks.get(projectId, taskId);
      setSelectedTask(task);
    } catch {
      // task not found or no permission
    }
  }

  if (projectsQuery.isLoading) return <Skeleton className="h-72 rounded-lg" />;

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={CalendarDays}
        description="Cree ou selectionne un projet pour voir le calendrier."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewTasks && !canViewTime) {
    return <AccessDeniedState description="Ton role ne permet pas de voir le calendrier de ce projet." />;
  }

  const isLoading = timeEntriesQuery.isLoading || tasksQuery.isLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle category="Calendrier" title="Vue mensuelle" />
        <div className="flex items-center gap-5">
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

      <ProjectCalendarView
        timeEntries={canViewTime && showTime ? timeEntries : []}
        tasks={canViewTasks && showTasks ? tasks : []}
        isLoading={isLoading}
        onDatesChange={(start) => setMonthDate(new Date(start.getFullYear(), start.getMonth(), 1))}
        onTaskClick={handleTaskClick}
        onTimeClick={handleTimeClick}
      />

      <TaskDetailModal
        task={selectedTask}
        projectId={projectId ?? 0}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setSelectedTask(null)}
      />

      <TimeEntryDetailDialog
        entry={selectedTimeEntry}
        projectId={projectId ?? 0}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setSelectedTimeEntry(null)}
        onTaskClick={canViewTasks ? handleTimeEntryTaskClick : undefined}
      />

      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}
