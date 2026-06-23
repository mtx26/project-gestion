"use client";

import type { Task } from "@project-gestion/types";
import { Calendar, CalendarClock, CircleCheck, Clock, Folder, Pencil, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { TaskPriorityBadge } from "@/components/badges/task-priority-badge";
import { TaskStatusBadge } from "@/components/badges/task-status-badge";
import { formatTaskDate } from "@/lib/task-utils";

interface TaskDetailModalProps {
  task: Task | null;
  folderNameById: Map<number, string>;
  members: { user: number; user_display_name: string }[];
  canEdit: boolean;
  canDelete: boolean;
  deletingId?: number | null;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  folderNameById,
  members,
  canEdit,
  canDelete,
  deletingId,
  onClose,
  onEdit,
  onDelete,
}: TaskDetailModalProps) {
  const folderName =
    task == null
      ? null
      : task.folder == null
        ? "Projet"
        : (folderNameById.get(task.folder) ?? `Dossier #${task.folder}`);

  const assigneeNames = task?.assigned_to.map(
    (uid) => members.find((m) => m.user === uid)?.user_display_name ?? `#${uid}`,
  ) ?? [];

  return (
    <Dialog open={task != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{task?.title}</DialogTitle>
        </DialogHeader>

        {task ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Dossier</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Folder className="size-3.5 shrink-0 text-amber-500" />
                  <span>{folderName}</span>
                </div>
              </div>

              {task.start_date ? (
                <div>
                  <p className="text-xs text-muted-foreground">Date de debut</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>{formatTaskDate(task.start_date)}</span>
                  </div>
                </div>
              ) : null}

              {task.due_date ? (
                <div>
                  <p className="text-xs text-muted-foreground">Echeance</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>{formatTaskDate(task.due_date)}</span>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-xs text-muted-foreground">Cree par</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{task.created_by_name ?? "—"}</span>
                </div>
              </div>

              {assigneeNames.length > 0 ? (
                <div className={assigneeNames.length > 1 ? "col-span-2" : undefined}>
                  <p className="text-xs text-muted-foreground">Assignes</p>
                  <div className="mt-0.5 flex items-start gap-1.5">
                    <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="leading-snug">{assigneeNames.join(", ")}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Cree le</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{formatTaskDate(task.created_at)}</span>
                </div>
              </div>

              {task.completed_at ? (
                <div>
                  <p className="text-xs text-muted-foreground">Terminee le</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <CircleCheck className="size-3.5 shrink-0 text-emerald-500" />
                    <span>{formatTaskDate(task.completed_at)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {task.description ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {canDelete && task && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deletingId === task.id}
              onClick={() => onDelete(task)}
            >
              <Trash2 className="size-4" />
              {deletingId === task.id ? "Suppression..." : "Supprimer"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">Fermer</Button>
            </DialogClose>
            {canEdit && task && onEdit ? (
              <Button type="button" size="sm" onClick={() => onEdit(task)}>
                <Pencil className="size-4" />
                Modifier
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
