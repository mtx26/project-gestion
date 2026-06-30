"use client";

import type { File as ApiFile } from "@project-gestion/types";
import { Clock3 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { TargetPickerDialog } from "@/components/pickers/target-tree-picker";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/forms/date-time-picker";
import { getErrorMessage } from "@/lib/errors";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { type TargetTreeNode, getTargetPayload } from "@/lib/target-utils";
import { api } from "@/lib/api";

export function TimeEntryForm({
  canRecordTime,
  projectId,
  startDate,
  endDate,
  hourlyRate,
  description,
  targetValue,
  targetTree,
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
  canRecordTime: boolean;
  projectId: number;
  startDate: string;
  endDate: string;
  hourlyRate: string;
  description: string;
  targetValue: string;
  targetTree: TargetTreeNode;
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
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    const newDocIds: number[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      const { folder } = getTargetPayload(targetValue);
      try {
        for (const file of pendingFiles) {
          const uploaded: ApiFile = await api.documents.upload(projectId, {
            file,
            folder: folder ?? undefined,
            name: file.name,
          });
          newDocIds.push(uploaded.id);
        }
      } catch (err) {
        setUploadError(getErrorMessage(err));
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    onSubmit(event, newDocIds);
  }

  const isSubmitting = uploading || isPending;

  if (!canRecordTime) {
    return (
      <Alert>
        <AlertDescription>Permission time_entry.edit requise pour enregistrer du temps.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Date de début</FieldLabel>
          <DateTimePicker value={startDate} onChange={onStartDateChange} placeholder="Début" maxDate={endDate} />
        </Field>
        <Field>
          <FieldLabel>Date de fin</FieldLabel>
          <DateTimePicker value={endDate} onChange={onEndDateChange} placeholder="Fin" minDate={startDate} />
        </Field>
      </div>

      <div className="flex items-end gap-3">
        <Field className="flex-1">
          <FieldLabel htmlFor="time-rate">Taux horaire</FieldLabel>
          <Input id="time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
        </Field>
        <p className="pb-2 text-xs text-muted-foreground">
          {formatDuration(durationMinutes)} · {formatMoney(computedTotal)}
        </p>
      </div>

      <Field>
        <FieldLabel>Cible</FieldLabel>
        <TargetPickerDialog
          targetTree={targetTree}
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
        existingDocs={[]}
        pendingFiles={pendingFiles}
        onRemoveDoc={() => {}}
        onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
        onRemoveFile={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
      />

      <FormErrorAlert error={uploadError ?? error} />

      <DialogFooter>
        <Button type="submit" disabled={durationMinutes <= 0 || isSubmitting}>
          <Clock3 className="size-4" />
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
