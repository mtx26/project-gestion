"use client";

import type { Task, TimeEntry } from "@project-gestion/types";
import { Clock3, Folder, FolderOpen, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge } from "@/components/ui/task-status-badge";
import { formatDuration, formatMoney } from "@/lib/task-utils";

function TimeTotals({ timeEntries }: { timeEntries: TimeEntry[] }) {
  const totals = timeEntries.reduce(
    (acc, e) => ({
      durationMinutes: acc.durationMinutes + e.duration_minutes,
      costAmount: acc.costAmount + Number(e.cost_amount),
      remainingAmount: acc.remainingAmount + Number(e.remaining_amount),
    }),
    { durationMinutes: 0, costAmount: 0, remainingAmount: 0 },
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Synthese</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Temps total</span>
          <span className="font-medium tabular-nums">{formatDuration(totals.durationMinutes)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Montant total</span>
          <span className="font-medium tabular-nums">{formatMoney(totals.costAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Reste a payer</span>
          <span className="font-medium tabular-nums">{formatMoney(totals.remainingAmount)}</span>
        </div>
      </div>
    </div>
  );
}

export function FolderPreviewPanel({
  selectedFolderId,
  selectedFolderName,
  selectedFolderCreatedBy,
  tasks,
  timeEntries,
  canViewTasks,
  canViewTime,
  isLoadingTasks,
  isLoadingTime,
  onOpenTask,
  onOpenTasks,
  onOpenTime,
}: {
  selectedFolderId: number | null;
  selectedFolderName: string | null;
  selectedFolderCreatedBy: string | null;
  tasks: Task[];
  timeEntries: TimeEntry[];
  canViewTasks: boolean;
  canViewTime: boolean;
  isLoadingTasks: boolean;
  isLoadingTime: boolean;
  onOpenTask: (task: Task) => void;
  onOpenTasks: () => void;
  onOpenTime: () => void;
}) {
  const headerName = selectedFolderId == null ? "Projet" : selectedFolderName;
  const headerIcon =
    selectedFolderId == null ? (
      <Folder className="size-4 shrink-0 text-primary" />
    ) : (
      <FolderOpen className="size-4 shrink-0 text-amber-500" />
    );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="truncate text-sm font-medium">{headerName}</span>
        </div>
        {selectedFolderCreatedBy ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Cree par {selectedFolderCreatedBy}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Apercu du dossier</p>
        )}
      </div>

      {canViewTasks ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <ListTodo className="size-3.5 text-sky-600" />
              Taches
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onOpenTasks}>
              Ouvrir
            </Button>
          </div>
          {isLoadingTasks ? (
            <Skeleton className="h-16 rounded" />
          ) : tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune tache liee.</p>
          ) : (
            <div className="space-y-1">
              {tasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs hover:bg-muted/70"
                  onClick={() => onOpenTask(task)}
                >
                  <span className="truncate">{task.title}</span>
                  <TaskStatusBadge status={task.status} className="shrink-0 text-[10px]" />
                </button>
              ))}
              {tasks.length > 5 ? (
                <p className="text-xs text-muted-foreground">+{tasks.length - 5} autres</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {canViewTime ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Clock3 className="size-3.5 text-primary" />
              Temps
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onOpenTime}>
              Ouvrir
            </Button>
          </div>
          {isLoadingTime ? (
            <Skeleton className="h-12 rounded" />
          ) : timeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune heure liee.</p>
          ) : (
            <TimeTotals timeEntries={timeEntries} />
          )}
        </div>
      ) : null}
    </div>
  );
}
