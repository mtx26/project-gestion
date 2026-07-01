"use client";

import type { TimeEntry } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, Clock, CreditCard, Folder, ListTodo, Pencil, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { PaymentStatusBadge } from "@/components/badges/payment-status-badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TargetPickerDialog } from "@/components/pickers/target-tree-picker";
import { Textarea } from "@/components/ui/textarea";
import { addMinutes, format, parseISO } from "date-fns";
import { DateTimePicker } from "@/components/forms/date-time-picker";
import { formatDateTime } from "@/lib/date-utils";
import { type TargetTreeNode, findTargetLabel, getTargetPayload, getTargetValueFromEntry } from "@/lib/target-utils";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { DetailField, DetailLabel, DetailModal, ModalDocs, ModalFooter, ModalGrid, ModalHero } from "@/components/dialogs/detail-layout";
import { getEntryTargetLabel, getPaymentStatus } from "../lib/time-filters";

const editTimeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  hourlyRate: z.string(),
  description: z.string(),
});
type EditTimeFormValues = z.infer<typeof editTimeSchema>;

function makePaymentSchema(remaining: number) {
  return z.object({
    mode: z.enum(["full", "partial"]),
    amount: z.string(),
  })
    .refine(
      (v) => v.mode !== "partial" || Number(v.amount) > 0,
      { message: "Le montant doit etre superieur a 0", path: ["amount"] },
    )
    .refine(
      (v) => v.mode !== "partial" || Number(v.amount) <= remaining,
      { message: "Le montant ne peut pas depasser le reste a payer", path: ["amount"] },
    );
}
type PaymentFormValues = { mode: "full" | "partial"; amount: string };

export type EditTimeSubmitData = {
  documentIds: number[];
  durationMinutes: number;
  startDate: string | null;
  hourlyRate: string | undefined;
  description: string | null;
  folder: number | null;
  task: number | null;
};

export function EditTimeEntryDialog({
  entry,
  projectId,
  targetTree,
  isPending,
  error,
  onCreateFolder,
  onOpenChange,
  onSubmit,
}: {
  entry: TimeEntry | null;
  projectId: number;
  targetTree: TargetTreeNode;
  isPending: boolean;
  error: string | null;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EditTimeSubmitData) => void;
}) {
  const form = useForm<EditTimeFormValues>({
    resolver: zodResolver(editTimeSchema),
    defaultValues: {
      startDate: entry?.start_date
        ? entry.start_date.slice(0, 16)
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: entry?.start_date
        ? format(addMinutes(parseISO(entry.start_date.slice(0, 16)), entry.duration_minutes), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      hourlyRate: entry?.hourly_rate ?? "0",
      description: entry?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(entry ? getTargetValueFromEntry(entry) : "project");
  const docs = useDocumentAttachment(
    entry?.documents_info ?? [],
  );

  const { startDate, endDate, hourlyRate } = form.watch();
  const durationMinutes = startDate && endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000))
    : 0;
  const durationHours = durationMinutes / 60;
  const computedTotal = durationHours > 0 ? durationHours * Number(hourlyRate) : 0;
  const selectedTargetLabel = findTargetLabel(targetTree, targetValue) ?? "Projet";

  async function handleSubmit(values: EditTimeFormValues) {
    const duration = values.startDate && values.endDate
      ? Math.max(0, Math.round((new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) / 60000))
      : 0;
    const { folder, task } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit({
      documentIds: docs.getAllDocIds(newDocIds),
      durationMinutes: duration,
      startDate: values.startDate || null,
      hourlyRate: values.hourlyRate === "" ? undefined : values.hourlyRate,
      description: values.description.trim() || null,
      folder,
      task,
    });
  }

  const isSubmitting = docs.uploading || isPending;

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;entree</DialogTitle>
          <DialogDescription>Ajuste la duree, le taux, la cible ou la description.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Date de début</FieldLabel>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <DateTimePicker value={field.value} onChange={field.onChange} placeholder="Début" maxDate={endDate} />
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Date de fin</FieldLabel>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <DateTimePicker value={field.value} onChange={field.onChange} placeholder="Fin" minDate={startDate} />
                )}
              />
            </Field>
          </div>

          <div className="flex items-end gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="edit-time-rate">Taux horaire</FieldLabel>
              <Input id="edit-time-rate" type="number" min="0" step="0.01" {...form.register("hourlyRate")} />
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
              onSelect={setTargetValue}
              onCreateFolder={onCreateFolder}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-time-description">Description</FieldLabel>
            <Textarea id="edit-time-description" rows={4} {...form.register("description")} />
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

          <FormErrorAlert error={docs.uploadError ?? error} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="button" disabled={durationMinutes <= 0 || isSubmitting} onClick={form.handleSubmit(handleSubmit)}>
            <Pencil className="size-4" />
            {isSubmitting ? "Modification..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TimeEntryDetailDialog({
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
          <span>{formatDateTime(entry.created_at)}</span>
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
                {entry.task != null
                  ? <ListTodo className="size-4 shrink-0 text-sky-600" />
                  : <Folder className="size-4 shrink-0 text-amber-500" />}
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
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { mode: "full" | "partial"; amount: string }) => void;
}) {
  const remainingAmount = Number(entry?.remaining_amount ?? 0);
  const schema = useMemo(() => makePaymentSchema(remainingAmount), [remainingAmount]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: "full", amount: entry?.remaining_amount ?? "" },
  });

  const mode = form.watch("mode");

  function handleSubmit(values: PaymentFormValues) {
    onSubmit(values);
  }

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer comme paye</DialogTitle>
          <DialogDescription>Reste a payer : {formatMoney(remainingAmount)}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                max={remainingAmount}
                step="0.01"
                {...form.register("amount")}
              />
              <FieldError errors={[form.formState.errors.amount]} />
            </Field>
          ) : null}

          <FormErrorAlert error={error} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isPending || remainingAmount <= 0}
            onClick={form.handleSubmit(handleSubmit)}
          >
            <CheckCircle2 className="size-4" />
            {isPending ? "Paiement..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
