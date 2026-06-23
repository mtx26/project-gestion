"use client";

import type { FolderTreeNode, Task } from "@project-gestion/types";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/pickers/tree-picker";

export function FileDraftDialogs(props: {
  taskOpen: boolean;
  taskFolderName: string | null;
  taskFolders: FolderTreeNode[];
  taskFolderId: number | null;
  taskTitle: string;
  taskDescription: string;
  taskPriority: Task["priority"];
  taskDueDate: string;
  taskIsPending: boolean;
  onTaskOpenChange: (open: boolean) => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onTaskFolderChange: (folderId: number | null) => void;
  onTaskPriorityChange: (value: Task["priority"]) => void;
  onTaskDueDateChange: (value: string) => void;
  onTaskSubmit: () => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  timeOpen: boolean;
  timeFolderName: string | null;
  timeHours: string;
  timeMinutes: string;
  timeHourlyRate: string;
  timeDescription: string;
  timeIsPending: boolean;
  onTimeOpenChange: (open: boolean) => void;
  onTimeHoursChange: (value: string) => void;
  onTimeMinutesChange: (value: string) => void;
  onTimeHourlyRateChange: (value: string) => void;
  onTimeDescriptionChange: (value: string) => void;
  onTimeSubmit: () => void;
}) {
  return (
    <>
      <TaskDraftDialog
        open={props.taskOpen}
        folderName={props.taskFolderName}
        folders={props.taskFolders}
        folderId={props.taskFolderId}
        title={props.taskTitle}
        description={props.taskDescription}
        priority={props.taskPriority}
        dueDate={props.taskDueDate}
        isPending={props.taskIsPending}
        onOpenChange={props.onTaskOpenChange}
        onTitleChange={props.onTaskTitleChange}
        onDescriptionChange={props.onTaskDescriptionChange}
        onFolderChange={props.onTaskFolderChange}
        onPriorityChange={props.onTaskPriorityChange}
        onDueDateChange={props.onTaskDueDateChange}
        onSubmit={props.onTaskSubmit}
        onCreateFolder={props.onCreateFolder}
      />
      <TimeDraftDialog
        open={props.timeOpen}
        folderName={props.timeFolderName}
        hours={props.timeHours}
        minutes={props.timeMinutes}
        hourlyRate={props.timeHourlyRate}
        description={props.timeDescription}
        isPending={props.timeIsPending}
        onOpenChange={props.onTimeOpenChange}
        onHoursChange={props.onTimeHoursChange}
        onMinutesChange={props.onTimeMinutesChange}
        onHourlyRateChange={props.onTimeHourlyRateChange}
        onDescriptionChange={props.onTimeDescriptionChange}
        onSubmit={props.onTimeSubmit}
      />
    </>
  );
}

export function TaskDraftDialog({
  open,
  folderName,
  folders,
  folderId,
  title,
  description,
  priority,
  dueDate,
  isPending,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onPriorityChange,
  onDueDateChange,
  onSubmit,
  onCreateFolder,
}: {
  open: boolean;
  folderName: string | null;
  folders: FolderTreeNode[];
  folderId: number | null;
  title: string;
  description: string;
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (folderId: number | null) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: () => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle tache</DialogTitle>
          <DialogDescription>
            {folderName ? `La tache sera liee au dossier ${folderName}.` : "La tache sera liee au projet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Dossier</FieldLabel>
            <TreePickerDialog
              mode="folder"
              folders={folders}
              selectedFolderId={folderId}
              buttonLabel={folderName ?? "Projet"}
              description="Selectionne le dossier qui recevra la tache."
              onSelect={onFolderChange}
              onCreateFolder={onCreateFolder}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-task-title">Titre</FieldLabel>
            <Input id="project-task-title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Priorite</FieldLabel>
              <Select value={priority} onValueChange={(v) => onPriorityChange(v as Task["priority"])}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Echeance</FieldLabel>
              <DatePicker value={dueDate} onChange={onDueDateChange} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="project-task-description">Description</FieldLabel>
            <Textarea id="project-task-description" rows={3} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="button" disabled={!title.trim() || isPending} onClick={onSubmit}>
            {isPending ? "Creation..." : "Creer la tache"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TimeDraftDialog({
  open,
  folderName,
  hours,
  minutes,
  hourlyRate,
  description,
  isPending,
  onOpenChange,
  onHoursChange,
  onMinutesChange,
  onHourlyRateChange,
  onDescriptionChange,
  onSubmit,
}: {
  open: boolean;
  folderName: string | null;
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const durationMinutes = Number(hours) * 60 + Number(minutes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter du temps</DialogTitle>
          <DialogDescription>
            {folderName ? `Le temps sera lie au dossier ${folderName}.` : "Le temps sera lie au projet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="project-time-hours">Heures</FieldLabel>
              <Input id="project-time-hours" type="number" min="0" value={hours} onChange={(e) => onHoursChange(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-time-minutes">Minutes</FieldLabel>
              <Input id="project-time-minutes" type="number" min="0" max="59" value={minutes} onChange={(e) => onMinutesChange(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="project-time-rate">Taux horaire</FieldLabel>
            <Input id="project-time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-time-description">Description</FieldLabel>
            <Textarea id="project-time-description" rows={3} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="button" disabled={durationMinutes <= 0 || isPending} onClick={onSubmit}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
