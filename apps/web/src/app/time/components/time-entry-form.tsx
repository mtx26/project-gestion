"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/forms/date-range-field";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { MoneyInput } from "@/components/forms/money-input";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { TreePickerDialog } from "@/components/pickers/tree-picker";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { getTargetPayload } from "@/lib/target-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";

const CREATE_FORM_ID = "time-entry-create-form";

export function TimeEntryForm({
  open,
  onOpenChange,
  canRecordTime,
  projectId,
  startDate,
  endDate,
  hourlyRate,
  description,
  targetValue,
  targetFolders,
  selectedTargetLabel,
  isPending,
  error,
  onStartDateChange,
  onEndDateChange,
  onHourlyRateChange,
  onDescriptionChange,
  onTargetValueChange,
  onCreateFolder,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRecordTime: boolean;
  projectId: number;
  startDate: string;
  endDate: string;
  hourlyRate: string;
  description: string;
  targetValue: string;
  targetFolders: FolderTreeNode[];
  selectedTargetLabel: string;
  isPending: boolean;
  error: string | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetValueChange: (value: string) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>, documentIds: number[]) => void;
}) {
  const durationMinutes = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000))
    : 0;
  const durationHours = durationMinutes / 60;
  const computedTotal = durationHours > 0 ? durationHours * Number(hourlyRate) : 0;
  const docs = useDocumentAttachment([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { folder } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit(event, newDocIds);
  }

  const isSubmitting = docs.uploading || isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouvelle entree"
      description="Encode une duree et lie-la au projet, a un dossier ou a une tache."
      error={canRecordTime ? (docs.uploadError ?? error) : undefined}
      footer={
        canRecordTime ? (
          <FormSubmitButton
            form={CREATE_FORM_ID}
            pending={isSubmitting}
            disabled={durationMinutes <= 0 || isSubmitting}
            label="Enregistrer"
            pendingLabel="Enregistrement..."
          />
        ) : (
          <DialogClose asChild>
            <Button type="button" variant="outline">Fermer</Button>
          </DialogClose>
        )
      }
    >
      {!canRecordTime ? (
        <Alert>
          <AlertDescription>Permission time_entry.edit requise pour enregistrer du temps.</AlertDescription>
        </Alert>
      ) : (
        <form id={CREATE_FORM_ID} className="space-y-4" onSubmit={handleSubmit}>
          <DateRangeField
            startValue={startDate}
            endValue={endDate}
            onStartChange={onStartDateChange}
            onEndChange={onEndDateChange}
          />

          <div className="flex items-end gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="time-rate">Taux horaire</FieldLabel>
              <MoneyInput id="time-rate" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
            </Field>
            <p className="pb-2 text-xs text-muted-foreground">
              {formatDuration(durationMinutes)} · {formatMoney(computedTotal)}
            </p>
          </div>

          <Field>
            <FieldLabel>Cible</FieldLabel>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={selectedTargetLabel}
              onSelect={onTargetValueChange}
              onCreateFolder={onCreateFolder}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="time-description">Description</FieldLabel>
            <Textarea id="time-description" rows={4} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
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
      )}
    </FormDialog>
  );
}
