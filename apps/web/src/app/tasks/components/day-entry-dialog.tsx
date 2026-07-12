"use client";

import type { DayEntryPayload, FolderTreeNode, ProjectMember } from "@project-gestion/types";
import { dayEntrySchema, type DayEntryFormInput, type DayEntryFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/forms/date-range-field";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { MemberCombobox } from "@/components/forms/member-combobox";
import { MoneyInput } from "@/components/forms/money-input";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { PrioritySelect } from "@/components/forms/priority-select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/pickers/tree-picker";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatDuration } from "@/lib/task-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { getFolderId, type FolderFilter } from "../lib/task-filters";

export function DayEntryFormDialog({
  open,
  projectId,
  members,
  folders,
  canViewFiles,
  isPending,
  error,
  onOpenChange,
  onCreateFolderAction,
  onSubmit,
}: {
  open: boolean;
  projectId: number;
  members: ProjectMember[];
  folders: FolderTreeNode[];
  canViewFiles: boolean;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: DayEntryPayload) => void;
}) {
  const form = useForm<DayEntryFormInput, unknown, DayEntryFormValues>({
    resolver: zodResolver(dayEntrySchema),
    defaultValues: {
      title: "",
      description: "",
      folder: "all",
      priority: "normal",
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      entries: [],
    },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "entries" });
  const docs = useDocumentAttachment([]);
  const membersById = useMemo(() => new Map(members.map((m) => [m.user, m])), [members]);

  useServerFieldErrors(form, error, [
    "title",
    "priority",
    { name: "startDate", serverField: "start_date" },
    { name: "endDate", serverField: "end_date" },
  ]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      docs.reset();
    }
    onOpenChange(next);
  }

  function handleMembersChange(ids: number[]) {
    // Preserve an already-selected person's edited rate; default new ones from
    // their project rate.
    const existingRateByUserId = new Map(fields.map((f) => [f.userId, f.hourlyRate]));
    replace(ids.map((id) => ({
      userId: id,
      hourlyRate: existingRateByUserId.get(id) ?? membersById.get(id)?.hourly_rate ?? "0",
    })));
  }

  async function submitForm(values: DayEntryFormValues) {
    const folder = getFolderId(values.folder as FolderFilter);
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) return;
    onSubmit({
      title: values.title,
      description: values.description ?? undefined,
      folder,
      priority: values.priority,
      start_date: values.startDate,
      end_date: values.endDate,
      documents: documentIds,
      entries: values.entries.map((entry) => ({
        user: entry.userId,
        hourly_rate: entry.hourlyRate || undefined,
      })),
    });
  }

  const [startDate, endDate] = useWatch({ control: form.control, name: ["startDate", "endDate"] });
  const folderValue = useWatch({ control: form.control, name: "folder" });
  const folderId = getFolderId((folderValue ?? "all") as FolderFilter);
  const durationMinutes = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000))
    : 0;
  const selectedUserIds = fields.map((f) => f.userId);
  // `errors.entries` is either the array-level `.min(1)` error (an object with
  // `.message`) or an array of per-row errors — only the former is renderable here.
  const entriesError = form.formState.errors.entries;
  const entriesRootError = entriesError && !Array.isArray(entriesError) ? entriesError : undefined;
  const isSubmitting = docs.uploading || isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nouvelle entrée de journée"
      description="Crée une tâche déjà terminée et enregistre le temps de chaque personne ayant travaillé dessus."
      error={docs.uploadError ?? getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="day-entry-form"
            pending={isSubmitting}
            disabled={durationMinutes <= 0 || isSubmitting}
            label="Créer"
            pendingLabel={docs.uploading ? "Upload…" : "Création..."}
          />
        </>
      }
    >
      <form id="day-entry-form" className="space-y-4" onSubmit={form.handleSubmit(submitForm)}>
        <Field>
          <FieldLabel htmlFor="day-entry-title">Titre</FieldLabel>
          <Input id="day-entry-title" placeholder="Ex : Pose du carrelage salle de bain" {...form.register("title")} />
          <FieldError errors={[form.formState.errors.title]} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
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
          <Field>
            <FieldLabel>Priorité</FieldLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => <PrioritySelect value={field.value} onChange={field.onChange} />}
            />
          </Field>
        </div>

        <DateRangeField
          startValue={startDate}
          endValue={endDate}
          onStartChange={(v) => form.setValue("startDate", v, { shouldValidate: true })}
          onEndChange={(v) => form.setValue("endDate", v, { shouldValidate: true })}
        />
        <FieldError errors={[form.formState.errors.startDate]} />
        <p className="text-xs text-muted-foreground">{formatDuration(durationMinutes)}</p>

        <Field>
          <FieldLabel htmlFor="day-entry-description">Ce qui a été fait</FieldLabel>
          <Textarea id="day-entry-description" rows={3} placeholder="Decris le travail effectue..." {...form.register("description")} />
        </Field>

        <div className="space-y-2">
          <FieldLabel>Personnes ayant travaillé</FieldLabel>
          <MemberCombobox members={members} value={selectedUserIds} onChange={handleMembersChange} />
          <FieldError errors={[entriesRootError]} />

          {fields.map((field, index) => {
            const member = membersById.get(field.userId);
            return (
              <div key={field.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {member?.user_display_name ?? "Membre"}
                </span>
                <Field className="w-32">
                  <MoneyInput
                    aria-label={`Taux horaire de ${member?.user_display_name ?? "cette personne"}`}
                    {...form.register(`entries.${index}.hourlyRate`)}
                  />
                </Field>
              </div>
            );
          })}
        </div>

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
