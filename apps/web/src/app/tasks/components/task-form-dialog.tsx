"use client";

import type { FolderTreeNode, Task, TaskPayload } from "@project-gestion/types";
import { taskSchema, type TaskFormInput, type TaskFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/forms/date-range-field";
import { DialogClose } from "@/components/ui/dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MemberCombobox } from "@/components/forms/member-combobox";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { PrioritySelect } from "@/components/forms/priority-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/pickers/tree-picker";
import { fromDateTimeLocalInput, toDateTimeLocalInput } from "@/lib/date-utils";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import type { FolderFilter } from "../lib/task-filters";
import { getFolderId } from "../lib/task-filters";
import type { TaskMember } from "./task-table";

export function TaskFormDialog({
  mode,
  open,
  task,
  projectId,
  canViewFiles,
  folders,
  members,
  initialFolder,
  isPending,
  error,
  onOpenChange,
  onCreateFolderAction,
  onSubmit,
}: {
  mode: "create" | "edit";
  open?: boolean;
  task?: Task | null;
  projectId: number;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  members: TaskMember[];
  initialFolder?: FolderFilter;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: TaskPayload) => void;
}) {
  const isOpen = mode === "create" ? (open ?? false) : task != null;
  const docs = useDocumentAttachment(task?.documents_info ?? []);

  const form = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      folder: task
        ? (task.folder == null ? "all" : `folder-${task.folder}`)
        : (initialFolder ?? "all"),
      status: task?.status ?? "todo",
      priority: task?.priority ?? "normal",
      startDate: task?.start_date ? toDateTimeLocalInput(task.start_date) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: task?.end_date ? toDateTimeLocalInput(task.end_date) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      assignees: task?.assigned_to ?? [],
    },
  });

  useServerFieldErrors(form, error, [
    "title",
    "priority",
    { name: "folder", serverField: "folder" },
    { name: "startDate", serverField: "start_date" },
    { name: "endDate", serverField: "end_date" },
    { name: "assignees", serverField: "assigned_to" },
  ]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      docs.reset();
    }
    onOpenChange(next);
  }

  async function submitForm(values: TaskFormValues) {
    const folder = getFolderId(values.folder as FolderFilter);
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) return;
    onSubmit({
      title: values.title,
      description: values.description,
      folder,
      status: values.status,
      priority: values.priority,
      start_date: fromDateTimeLocalInput(values.startDate),
      end_date: fromDateTimeLocalInput(values.endDate),
      assigned_to: values.assignees,
      documents: documentIds,
    });
  }

  const folderValue = useWatch({ control: form.control, name: "folder" });
  const folderId = getFolderId(folderValue as FolderFilter);
  const startDateValue = useWatch({ control: form.control, name: "startDate" });
  const endDateValue = useWatch({ control: form.control, name: "endDate" });
  const isSubmitting = docs.uploading || isPending;

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={mode === "create" ? "Nouvelle tache" : "Modifier la tache"}
      description={
        mode === "create"
          ? "Ajoute une tache et rattache-la au bon dossier si necessaire."
          : "Modifie le titre, la cible, le statut et les informations de suivi."
      }
      error={docs.uploadError ?? getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="task-form"
            pending={isSubmitting}
            disabled={isSubmitting}
            label={mode === "create" ? "Creer" : "Enregistrer"}
            pendingLabel={docs.uploading ? "Upload…" : mode === "create" ? "Creation..." : "Enregistrement..."}
          />
        </>
      }
    >
      <form id="task-form" className="space-y-4" onSubmit={form.handleSubmit(submitForm)}>
        <Field>
          <FieldLabel htmlFor="task-form-title">Titre</FieldLabel>
          <Input id="task-form-title" {...form.register("title")} />
          <FieldError errors={[form.formState.errors.title]} />
        </Field>

        <div className={mode === "edit" ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
          {canViewFiles ? (
            <Field>
              <FieldLabel>Dossier</FieldLabel>
              <Controller
                control={form.control}
                name="folder"
                render={({ field }) => (
                  <TreePickerDialog
                    mode="folder"
                    folders={folders}
                    selectedFolderId={folderId}
                    buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                    description="Selectionne le dossier qui recevra la tache."
                    onSelect={(id) => field.onChange(id == null ? "all" : `folder-${id}`)}
                    onCreateFolderAction={onCreateFolderAction}
                  />
                )}
              />
            </Field>
          ) : null}
          {mode === "edit" ? (
            <Field>
              <FieldLabel>Statut</FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">A faire</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="done">Termine</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel>Priorite</FieldLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => <PrioritySelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
        </div>

        <DateRangeField
          startValue={startDateValue}
          endValue={endDateValue}
          onStartChange={(v) => form.setValue("startDate", v, { shouldValidate: true })}
          onEndChange={(v) => form.setValue("endDate", v, { shouldValidate: true })}
        />
        <FieldError errors={[form.formState.errors.startDate]} />

        {members.length > 0 ? (
          <Field>
            <FieldLabel>Assignes</FieldLabel>
            <Controller
              control={form.control}
              name="assignees"
              render={({ field }) => (
                <MemberCombobox members={members} value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="task-form-description">Description</FieldLabel>
          <Textarea id="task-form-description" rows={3} {...form.register("description")} />
        </Field>

        <MultiDocumentAttachmentField
          projectId={projectId}
          existingDocs={docs.existingDocs}
          pendingFiles={docs.pendingFiles}
          uploading={docs.uploading}
          onRemoveDoc={docs.removeExistingDoc}
          onAddFiles={docs.addPendingFiles}
          onRemoveFile={docs.removePendingFile}
        />
      </form>
    </FormDialog>
  );
}

