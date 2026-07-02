"use client";

import type { FolderTreeNode, Task } from "@project-gestion/types";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { PrioritySelect } from "@/components/forms/priority-select";
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
  taskEndDate: string;
  taskIsPending: boolean;
  onTaskOpenChange: (open: boolean) => void;
  onTaskTitleChange: (value: string) => void;
  onTaskDescriptionChange: (value: string) => void;
  onTaskFolderChange: (folderId: number | null) => void;
  onTaskPriorityChange: (value: Task["priority"]) => void;
  onTaskEndDateChange: (value: string) => void;
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
        endDate={props.taskEndDate}
        isPending={props.taskIsPending}
        onOpenChange={props.onTaskOpenChange}
        onTitleChange={props.onTaskTitleChange}
        onDescriptionChange={props.onTaskDescriptionChange}
        onFolderChange={props.onTaskFolderChange}
        onPriorityChange={props.onTaskPriorityChange}
        onEndDateChange={props.onTaskEndDateChange}
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
  endDate,
  isPending,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onPriorityChange,
  onEndDateChange,
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
  endDate: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (folderId: number | null) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouvelle tache"
      description={folderName ? `La tache sera liee au dossier ${folderName}.` : "La tache sera liee au projet."}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            onClick={onSubmit}
            pending={isPending}
            disabled={!title.trim() || isPending}
            label="Creer la tache"
            pendingLabel="Creation..."
          />
        </>
      }
    >
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
            <PrioritySelect value={priority} onChange={onPriorityChange} />
          </Field>
          <Field>
            <FieldLabel>Date de fin</FieldLabel>
            <DatePicker value={endDate} onChange={onEndDateChange} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="project-task-description">Description</FieldLabel>
          <Textarea id="project-task-description" rows={3} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajouter du temps"
      description={folderName ? `Le temps sera lie au dossier ${folderName}.` : "Le temps sera lie au projet."}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            onClick={onSubmit}
            pending={isPending}
            disabled={durationMinutes <= 0 || isPending}
            label="Enregistrer"
            pendingLabel="Enregistrement..."
          />
        </>
      }
    >
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
    </FormDialog>
  );
}
