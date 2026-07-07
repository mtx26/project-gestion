"use client";

import type { FolderTreeNode, TimeEntry } from "@project-gestion/types";
import {
  makeCorrectionSchema,
  makePaymentSchema,
  timeEntrySchema,
  type CorrectionFormValues,
  type PaymentFormValues,
  type TimeEntryFormInput,
  type TimeEntryFormValues,
} from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Clock, CreditCard, ListTodo, Pencil, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { DateRangeField } from "@/components/forms/date-range-field";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/forms/money-input";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { PaymentStatusBadge } from "@/components/badges/payment-status-badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TargetField, TreeIcon } from "@/components/pickers/tree-picker";
import { getTargetPayload, getTargetValueFromEntry } from "@/lib/target-utils";
import { Textarea } from "@/components/ui/textarea";
import { addMinutes, format, parseISO } from "date-fns";
import { formatDateTime } from "@/lib/date-utils";
import { getErrorMessage } from "@/lib/errors";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { getPaymentStatus } from "@/lib/time-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { DetailField, DetailLabel, DetailModal, ModalDocs, ModalFooter, ModalGrid, ModalHero } from "@/components/dialogs/detail-layout";
import { getEntryTargetLabel } from "../lib/time-filters";

export type TimeEntrySubmitData = {
  documentIds: number[];
  durationMinutes: number;
  startDate: string;
  hourlyRate: string | undefined;
  description: string | null;
  folder: number | null;
  task: number | null;
};

/** Single create/edit dialog for time entries, matching the `mode="create"|"edit"`
 * shape every other `<Feature>FormDialog` uses: for `mode="edit"`, mount a fresh
 * instance per entity via `key={entry?.id}` (see `TimePageContent`), openness is
 * derived from `entry` being non-null. For `mode="create"`, `open`/`onOpenChange`
 * control it directly and `defaultHourlyRate` seeds the rate field. */
export function TimeEntryFormDialog({
  mode,
  open,
  entry,
  projectId,
  canRecordTime = true,
  defaultHourlyRate,
  targetFolders,
  isPending,
  error,
  onCreateFolder,
  onOpenChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  open?: boolean;
  entry?: TimeEntry | null;
  projectId: number;
  canRecordTime?: boolean;
  defaultHourlyRate?: string;
  targetFolders: FolderTreeNode[];
  isPending: boolean;
  error: unknown;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TimeEntrySubmitData) => void;
}) {
  const isOpen = mode === "create" ? (open ?? false) : entry != null;
  const referenceStart = entry ? entry.start_date.slice(0, 16) : "";

  const form = useForm<TimeEntryFormInput, unknown, TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      startDate: referenceStart || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: referenceStart && entry
        ? format(addMinutes(parseISO(referenceStart), entry.duration_minutes), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      hourlyRate: entry?.hourly_rate ?? defaultHourlyRate ?? "0",
      description: entry?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(entry ? getTargetValueFromEntry(entry) : "project");
  const docs = useDocumentAttachment(
    entry?.documents_info ?? [],
  );

  const [startDate, endDate, hourlyRate] = useWatch({
    control: form.control,
    name: ["startDate", "endDate", "hourlyRate"],
  });
  const durationMinutes = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000))
    : 0;
  const durationHours = durationMinutes / 60;
  const computedTotal = durationHours > 0 ? durationHours * Number(hourlyRate) : 0;

  useServerFieldErrors(form, error, [
    { name: "startDate", serverField: "start_date" },
    { name: "hourlyRate", serverField: "hourly_rate" },
    "description",
  ]);

  async function submitForm(values: TimeEntryFormValues) {
    const duration = values.startDate && values.endDate
      ? Math.max(0, Math.round((new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) / 60000))
      : 0;
    const { folder, task } = getTargetPayload(targetValue);
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) return;
    onSubmit({
      documentIds,
      durationMinutes: duration,
      startDate: values.startDate,
      hourlyRate: values.hourlyRate,
      description: values.description,
      folder,
      task,
    });
  }

  const isSubmitting = docs.uploading || isPending;

  function handleOpenChange(next: boolean) {
    if (!next && mode === "create") {
      form.reset();
      docs.reset();
      setTargetValue("project");
    }
    onOpenChange(next);
  }

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}
      description={
        mode === "create"
          ? "Encode une duree et lie-la au projet, a un dossier ou a une tache."
          : "Ajuste la duree, le taux, la cible ou la description."
      }
      error={canRecordTime ? (docs.uploadError ?? getErrorMessage(error)) : undefined}
      footer={
        canRecordTime ? (
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <FormSubmitButton
              form="time-entry-form"
              pending={isSubmitting}
              disabled={durationMinutes <= 0 || isSubmitting}
              label="Enregistrer"
              pendingLabel={mode === "create" ? "Enregistrement..." : "Modification..."}
            />
          </>
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
        <form id="time-entry-form" className="space-y-4" onSubmit={form.handleSubmit(submitForm)}>
          <DateRangeField
            startValue={startDate}
            endValue={endDate}
            onStartChange={(v) => form.setValue("startDate", v, { shouldValidate: true })}
            onEndChange={(v) => form.setValue("endDate", v, { shouldValidate: true })}
          />
          <FieldError errors={[form.formState.errors.startDate]} />

          <div className="flex items-end gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="time-entry-rate">Taux horaire</FieldLabel>
              <MoneyInput id="time-entry-rate" {...form.register("hourlyRate")} />
            </Field>
            <p className="pb-2 text-xs text-muted-foreground">
              {formatDuration(durationMinutes)} · {formatMoney(computedTotal)}
            </p>
          </div>

          <TargetField
            folders={targetFolders}
            value={targetValue}
            onChange={setTargetValue}
            onCreateFolder={onCreateFolder}
          />

          <Field>
            <FieldLabel htmlFor="time-entry-description">Description</FieldLabel>
            <Textarea id="time-entry-description" rows={4} {...form.register("description")} />
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

export function TimeEntryDetailModal({
  entry,
  projectId,
  canEdit = false,
  canPay = false,
  canDelete = false,
  deletingId,
  isOpeningDocument = false,
  onOpenDocument,
  onClose,
  onEdit,
  onPay,
  onCorrectPayment,
  onDelete,
  onTaskClick,
}: {
  entry: TimeEntry | null;
  projectId: number;
  canEdit?: boolean;
  canPay?: boolean;
  canDelete?: boolean;
  deletingId?: number | null;
  isOpeningDocument?: boolean;
  onOpenDocument?: (documentId: number) => void;
  onClose: () => void;
  onEdit?: (entry: TimeEntry) => void;
  onPay?: (entry: TimeEntry) => void;
  onCorrectPayment?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
  onTaskClick?: (taskId: number) => void;
}) {
  if (!entry) return null;

  const paymentStatus = getPaymentStatus(entry);
  const targetLabel = getEntryTargetLabel(entry);
  const displayName = entry.user_display_name;
  const paidRatio =
    Number(entry.cost_amount) > 0
      ? Math.min(100, (Number(entry.paid_amount) / Number(entry.cost_amount)) * 100)
      : 100;

  return (
    <DetailModal
      open
      onClose={onClose}
      title={entry.description || "Temps enregistre"}
      footer={
        <ModalFooter
          destructive={canDelete && onDelete ? {
            label: deletingId === entry.id ? "Suppression..." : "Supprimer",
            onClick: () => onDelete(entry),
            disabled: deletingId === entry.id,
          } : undefined}
          actions={
            <>
              {canPay && onPay && paymentStatus !== "paid" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onPay(entry)}>
                  <CreditCard className="size-4" />
                  Payer
                </Button>
              ) : null}
              {canPay && onCorrectPayment && paymentStatus !== "unpaid" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onCorrectPayment(entry)}>
                  <Pencil className="size-4" />
                  Corriger le paiement
                </Button>
              ) : null}
              {canEdit && onEdit ? (
                <Button type="button" size="sm" onClick={() => onEdit(entry)}>
                  <Pencil className="size-4" />
                  Modifier
                </Button>
              ) : null}
            </>
          }
        />
      }
    >
      <ModalHero>
        <PaymentStatusBadge status={paymentStatus} />
        <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">{formatMoney(entry.cost_amount)}</p>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {formatDuration(entry.duration_minutes)}
          </span>
          <span>·</span>
          <span>{formatMoney(entry.hourly_rate)}/h</span>
        </div>
      </ModalHero>

      <ModalGrid>
        <DetailField label="Utilisateur" icon={UserRound}>
          <span>{displayName}</span>
        </DetailField>
        <DetailField label="Date" icon={CalendarDays}>
          <span>{formatDateTime(entry.start_date)}</span>
        </DetailField>
        {(entry.task != null || entry.folder != null) ? (
          <DetailField label="Cible" className="col-span-2">
            {entry.task != null && onTaskClick ? (
              <button
                type="button"
                className="flex items-center gap-2 font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => onTaskClick(entry.task!)}
              >
                <ListTodo className="size-4 shrink-0 text-sky-600" />
                {targetLabel}
              </button>
            ) : (
              <>
                <TreeIcon type={entry.task != null ? "task" : "folder"} />
                <span>{targetLabel}</span>
              </>
            )}
          </DetailField>
        ) : null}
      </ModalGrid>

      <div className="pt-5">
        <DetailLabel className="mb-3">Paiement</DetailLabel>
        <div className="mb-4 flex items-center gap-3">
          <Progress value={paidRatio} className="h-2 flex-1" />
          <span className="min-w-[3ch] text-right text-sm font-semibold tabular-nums">{Math.round(paidRatio)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Paye</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(entry.paid_amount)}</p>
          </div>
          <div className={cn("rounded-lg px-4 py-3", paymentStatus === "paid" ? "bg-muted/50" : "bg-orange-50 dark:bg-orange-950/30")}>
            <p className={cn("text-[11px] font-medium uppercase tracking-wide", paymentStatus === "paid" ? "text-muted-foreground" : "text-orange-700 dark:text-orange-400")}>Reste</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums", paymentStatus === "paid" ? "text-muted-foreground" : "text-orange-700 dark:text-orange-400")}>
              {paymentStatus === "paid" ? "—" : formatMoney(entry.remaining_amount)}
            </p>
          </div>
        </div>
      </div>

      <ModalDocs
        docs={entry.documents_info ?? []}
        projectId={projectId}
        isOpening={isOpeningDocument}
        onOpen={(id) => onOpenDocument?.(id)}
      />
    </DetailModal>
  );
}

export function PaymentDialog({
  entry,
  isPending,
  error,
  onOpenChange,
  onSubmit,
}: {
  entry: TimeEntry | null;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { mode: "full" | "partial"; amount: string }) => void;
}) {
  const remainingAmount = Number(entry?.remaining_amount ?? 0);
  const schema = makePaymentSchema(remainingAmount);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: "full", amount: entry?.remaining_amount ?? "" },
  });

  useServerFieldErrors(form, error, ["amount"]);

  const mode = useWatch({ control: form.control, name: "mode" });

  return (
    <FormDialog
      open={entry != null}
      onOpenChange={onOpenChange}
      title="Marquer comme paye"
      description={`Reste a payer : ${formatMoney(remainingAmount)}.`}
      maxWidth="md"
      error={getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="payment-form"
            pending={isPending}
            disabled={remainingAmount <= 0}
            label="Confirmer"
            pendingLabel="Paiement..."
          />
        </>
      }
    >
      <form id="payment-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Controller
          control={form.control}
          name="mode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Payer le reste complet</SelectItem>
                <SelectItem value="partial">Paiement partiel</SelectItem>
              </SelectContent>
            </Select>
          )}
        />

        {mode === "partial" ? (
          <Field>
            <Label htmlFor="payment-amount">Montant paye</Label>
            <MoneyInput id="payment-amount" {...form.register("amount")} />
            <FieldError errors={[form.formState.errors.amount]} />
          </Field>
        ) : null}
      </form>
    </FormDialog>
  );
}

export function CorrectPaymentDialog({
  entry,
  isPending,
  error,
  onOpenChange,
  onSubmit,
}: {
  entry: TimeEntry | null;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: string) => void;
}) {
  const costAmount = Number(entry?.cost_amount ?? 0);
  const paidAmount = entry?.paid_amount ?? "0";
  const paidAmountNumber = Number(paidAmount);
  const schema = makeCorrectionSchema(costAmount, paidAmountNumber);

  const form = useForm<CorrectionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: paidAmount },
  });

  useServerFieldErrors(form, error, ["amount"]);

  return (
    <FormDialog
      open={entry != null}
      onOpenChange={onOpenChange}
      title="Corriger le paiement"
      description={`Actuellement paye : ${formatMoney(paidAmount)} sur ${formatMoney(costAmount)}.`}
      maxWidth="md"
      error={getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="correction-form"
            pending={isPending}
            label="Corriger"
            pendingLabel="Correction..."
          />
        </>
      }
    >
      <form id="correction-form" onSubmit={form.handleSubmit((values) => onSubmit(values.amount))}>
        <Field>
          <Label htmlFor="payment-correction-amount">Nouveau montant paye</Label>
          <MoneyInput
            id="payment-correction-amount"
            {...form.register("amount")}
          />
          <FieldError errors={[form.formState.errors.amount]} />
          <p className="text-xs text-muted-foreground">
            Une entree de correction (depense ou remboursement) sera creee pour la difference.
          </p>
        </Field>
      </form>
    </FormDialog>
  );
}
