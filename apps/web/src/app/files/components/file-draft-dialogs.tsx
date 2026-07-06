"use client";

import type { FolderTreeNode, Task } from "@project-gestion/types";
import {
  taskDraftSchema,
  timeDraftSchema,
  type TaskDraftFormValues,
  type TimeDraftFormValues,
} from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import { PrioritySelect } from "@/components/forms/priority-select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/pickers/tree-picker";
import { getErrorMessage } from "@/lib/errors";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";

export type TaskDraftSubmitData = {
  title: string;
  description: string | null;
  priority: Task["priority"];
  endDate: string | null;
};

export type TimeDraftSubmitData = {
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string | null;
};

export function FileDraftDialogs(props: {
  taskOpen: boolean;
  taskFolderName: string | null;
  taskFolders: FolderTreeNode[];
  taskFolderId: number | null;
  taskIsPending: boolean;
  taskError?: unknown;
  onTaskOpenChange: (open: boolean) => void;
  onTaskFolderChange: (folderId: number | null) => void;
  onTaskSubmit: (data: TaskDraftSubmitData) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  timeOpen: boolean;
  timeFolderName: string | null;
  timeDefaultHourlyRate: string;
  timeIsPending: boolean;
  timeError?: unknown;
  onTimeOpenChange: (open: boolean) => void;
  onTimeSubmit: (data: TimeDraftSubmitData) => void;
}) {
  return (
    <>
      <TaskDraftDialog
        open={props.taskOpen}
        folderName={props.taskFolderName}
        folders={props.taskFolders}
        folderId={props.taskFolderId}
        isPending={props.taskIsPending}
        error={props.taskError}
        onOpenChange={props.onTaskOpenChange}
        onFolderChange={props.onTaskFolderChange}
        onSubmit={props.onTaskSubmit}
        onCreateFolder={props.onCreateFolder}
      />
      <TimeDraftDialog
        open={props.timeOpen}
        folderName={props.timeFolderName}
        defaultHourlyRate={props.timeDefaultHourlyRate}
        isPending={props.timeIsPending}
        error={props.timeError}
        onOpenChange={props.onTimeOpenChange}
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
  isPending,
  error,
  onOpenChange,
  onFolderChange,
  onSubmit,
  onCreateFolder,
}: {
  open: boolean;
  folderName: string | null;
  folders: FolderTreeNode[];
  folderId: number | null;
  isPending: boolean;
  error?: unknown;
  onOpenChange: (open: boolean) => void;
  onFolderChange: (folderId: number | null) => void;
  onSubmit: (data: TaskDraftSubmitData) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
}) {
  const form = useForm<TaskDraftFormValues>({
    resolver: zodResolver(taskDraftSchema),
    defaultValues: { title: "", description: "", priority: "normal", endDate: "" },
  });

  useServerFieldErrors(form, error, ["title", "priority", { name: "endDate", serverField: "end_date" }]);

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  function handleSubmit(values: TaskDraftFormValues) {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      endDate: values.endDate || null,
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nouvelle tache"
      description={folderName ? `La tache sera liee au dossier ${folderName}.` : "La tache sera liee au projet."}
      error={getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            onClick={form.handleSubmit(handleSubmit)}
            pending={isPending}
            disabled={isPending}
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
          <Input id="project-task-title" {...form.register("title")} />
          <FieldError errors={[form.formState.errors.title]} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Priorite</FieldLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => <PrioritySelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field>
            <FieldLabel>Date de fin</FieldLabel>
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="project-task-description">Description</FieldLabel>
          <Textarea id="project-task-description" rows={3} {...form.register("description")} />
        </Field>
      </div>
    </FormDialog>
  );
}

export function TimeDraftDialog({
  open,
  folderName,
  defaultHourlyRate,
  isPending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  folderName: string | null;
  defaultHourlyRate: string;
  isPending: boolean;
  error?: unknown;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TimeDraftSubmitData) => void;
}) {
  const form = useForm<TimeDraftFormValues>({
    resolver: zodResolver(timeDraftSchema),
    defaultValues: { hours: "1", minutes: "0", hourlyRate: defaultHourlyRate, description: "" },
  });

  useServerFieldErrors(form, error, [{ name: "hourlyRate", serverField: "hourly_rate" }, "description"]);

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  function handleSubmit(values: TimeDraftFormValues) {
    onSubmit({
      hours: values.hours,
      minutes: values.minutes,
      hourlyRate: values.hourlyRate,
      description: values.description.trim() || null,
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Ajouter du temps"
      description={folderName ? `Le temps sera lie au dossier ${folderName}.` : "Le temps sera lie au projet."}
      error={getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            onClick={form.handleSubmit(handleSubmit)}
            pending={isPending}
            disabled={isPending}
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
            <Input id="project-time-hours" type="number" min="0" {...form.register("hours")} />
            <FieldError errors={[form.formState.errors.hours]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-time-minutes">Minutes</FieldLabel>
            <Input id="project-time-minutes" type="number" min="0" max="59" {...form.register("minutes")} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="project-time-rate">Taux horaire</FieldLabel>
          <MoneyInput id="project-time-rate" {...form.register("hourlyRate")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="project-time-description">Description</FieldLabel>
          <Textarea id="project-time-description" rows={3} {...form.register("description")} />
        </Field>
      </div>
    </FormDialog>
  );
}
