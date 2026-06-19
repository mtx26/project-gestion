"use client";

import type { Task } from "@project-gestion/types";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatTaskDate,
  getPriorityClassName,
  getPriorityLabel,
  getStatusClassName,
  getStatusLabel,
} from "@/lib/task-utils";

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

  return (
    <Dialog open={task != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{task?.title}</DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={getStatusClassName(task.status)}>
                {getStatusLabel(task.status)}
              </Badge>
              <Badge variant="outline" className={getPriorityClassName(task.priority)}>
                {getPriorityLabel(task.priority)}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Dossier</p>
                <p className="mt-1 text-sm">{folderName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Echeance</p>
                <p className="mt-1 text-sm">{task.due_date ? formatTaskDate(task.due_date) : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Cree par</p>
                <p className="mt-1 text-sm">{task.created_by_name ?? "—"}</p>
              </div>
              {task.assigned_to.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Assignes</p>
                  <p className="mt-1 text-sm">
                    {task.assigned_to
                      .map((uid) => members.find((m) => m.user === uid)?.user_display_name ?? `#${uid}`)
                      .join(", ")}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Creation</p>
                <p className="mt-1 text-sm">{formatTaskDate(task.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Terminee le</p>
                <p className="mt-1 text-sm">{task.completed_at ? formatTaskDate(task.completed_at) : "—"}</p>
              </div>
            </div>
            {task.description ? (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p>
              </div>
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
              <Button type="button" variant="outline" size="sm">
                Fermer
              </Button>
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
