"use client";

import type { File as ApiFile } from "@project-gestion/types";
import { Clock3 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/ui/multi-document-attachment-field";
import { TargetPickerDialog } from "@/components/ui/target-tree-picker";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { type TargetTreeNode, getTargetPayload } from "@/lib/target-utils";
import { api } from "@/lib/api";

export function TimeEntryForm({
  canRecordTime,
  projectId,
  hours,
  minutes,
  hourlyRate,
  description,
  targetValue,
  targetTree,
  selectedTargetLabel,
  isPending,
  error,
  onHoursChange,
  onMinutesChange,
  onHourlyRateChange,
  onDescriptionChange,
  onTargetValueChange,
  onCreateFolder,
  onSubmit,
}: {
  canRecordTime: boolean;
  projectId: number;
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string;
  targetValue: string;
  targetTree: TargetTreeNode;
  selectedTargetLabel: string;
  isPending: boolean;
  error: string | null;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetValueChange: (value: string) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>, documentIds: number[]) => void;
}) {
  const durationMinutes = Number(hours) * 60 + Number(minutes);
  const durationHours = durationMinutes / 60;
  const computedTotal = durationHours > 0 ? (durationHours * Number(hourlyRate)).toFixed(2) : "0.00";
  const [totalDraft, setTotalDraft] = useState<string | null>(null);
  const totalValue = totalDraft ?? computedTotal;
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleTotalChange(value: string) {
    setTotalDraft(value);
    const total = Number(value);
    if (durationHours > 0 && total >= 0 && value !== "") {
      onHourlyRateChange((total / durationHours).toFixed(2));
    }
  }

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
          <FieldLabel htmlFor="time-hours">Heures</FieldLabel>
          <Input id="time-hours" type="number" min="0" value={hours} onChange={(e) => onHoursChange(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="time-minutes">Minutes</FieldLabel>
          <Input id="time-minutes" type="number" min="0" max="59" value={minutes} onChange={(e) => onMinutesChange(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="time-rate">Taux horaire</FieldLabel>
          <Input id="time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="time-total">Total</FieldLabel>
          <Input
            id="time-total"
            type="number"
            min="0"
            step="0.01"
            value={totalValue}
            onChange={(e) => handleTotalChange(e.target.value)}
            onBlur={() => setTotalDraft(null)}
          />
        </Field>
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
