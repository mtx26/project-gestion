"use client";

import type { Task } from "@project-gestion/types";
import { Calendar, CalendarClock, CircleCheck, Clock, Folder, Pencil, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskPriorityBadge } from "@/components/badges/task-priority-badge";
import { TaskStatusBadge } from "@/components/badges/task-status-badge";
import {
  DetailField,
  DetailLabel,
  DetailModal,
  ModalFooter,
  ModalGrid,
  ModalHero,
} from "@/components/dialogs/detail-layout";
import { formatDate } from "@/lib/task-utils";

interface TaskDetailModalProps {
  task: Task | null;
  canEdit?: boolean;
  canDelete?: boolean;
  deletingId?: number | null;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  canEdit = false,
  canDelete = false,
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
        : (task.folder_name ?? `Dossier #${task.folder}`);

  const assigneeNames = task?.assigned_to_display_names ?? [];

  return (
    <DetailModal
      open={task != null}
      onClose={onClose}
      title={task?.title ?? ""}
      footer={
        <ModalFooter
          destructive={
            canDelete && task && onDelete
              ? {
                  label: deletingId === task.id ? "Suppression..." : "Supprimer",
                  onClick: () => onDelete(task),
                  disabled: deletingId === task.id,
                }
              : undefined
          }
          actions={
            canEdit && task && onEdit ? (
              <Button type="button" size="sm" onClick={() => onEdit(task)}>
                <Pencil className="size-4" />
                Modifier
              </Button>
            ) : undefined
          }
        />
      }
    >
      {task ? (
        <>
          <ModalHero>
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
          </ModalHero>

          <ModalGrid>
            {task.folder != null ? (
              <DetailField label="Dossier" icon={Folder} iconClassName="text-amber-500" className="col-span-2">
                <span>{folderName}</span>
              </DetailField>
            ) : null}
            {task.start_date ? (
              <DetailField label="Date de debut" icon={CalendarClock}>
                <span>{formatDate(task.start_date)}</span>
              </DetailField>
            ) : null}
            {task.end_date ? (
              <DetailField label="Date de fin" icon={Calendar}>
                <span>{formatDate(task.end_date)}</span>
              </DetailField>
            ) : null}
            <DetailField label="Cree par" icon={UserRound}>
              <span>{task.created_by_name ?? "—"}</span>
            </DetailField>
            {assigneeNames.length > 0 ? (
              <DetailField
                label="Assignes"
                icon={Users}
                className={assigneeNames.length > 1 ? "col-span-2" : undefined}
              >
                <span>{assigneeNames.join(", ")}</span>
              </DetailField>
            ) : null}
          </ModalGrid>

          <ModalGrid>
            <DetailField label="Cree le" icon={Clock}>
              <span>{formatDate(task.created_at)}</span>
            </DetailField>
            {task.completed_at ? (
              <DetailField label="Terminee le" icon={CircleCheck} iconClassName="text-emerald-500">
                <span>{formatDate(task.completed_at)}</span>
              </DetailField>
            ) : null}
          </ModalGrid>

          {task.description ? (
            <div className="pt-5">
              <DetailLabel>Description</DetailLabel>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {task.description}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </DetailModal>
  );
}
