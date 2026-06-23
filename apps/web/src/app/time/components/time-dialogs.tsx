"use client";

import type { TimeEntry } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CreditCard, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { PaymentStatusBadge } from "@/components/badges/payment-status-badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TargetPickerDialog } from "@/components/pickers/target-tree-picker";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/date-utils";
import { type TargetTreeNode, findTargetLabel, getTargetPayload, getTargetValueFromEntry } from "@/lib/target-utils";
import { formatDuration, formatMoney } from "@/lib/task-utils";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { getEntryTargetLabel, getPaymentStatus } from "../lib/time-filters";

const editTimeSchema = z.object({
  hours: z.string(),
  minutes: z.string(),
  hourlyRate: z.string(),
  description: z.string(),
});
type EditTimeFormValues = z.infer<typeof editTimeSchema>;

const paymentSchema = z.object({
  mode: z.enum(["full", "partial"]),
  amount: z.string(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

export type EditTimeSubmitData = {
  documentIds: number[];
  durationMinutes: number;
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
      hours: entry ? String(Math.floor(entry.duration_minutes / 60)) : "1",
      minutes: entry ? String(entry.duration_minutes % 60) : "0",
      hourlyRate: entry?.hourly_rate ?? "0",
      description: entry?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(entry ? getTargetValueFromEntry(entry) : "project");
  const [totalDraft, setTotalDraft] = useState<string | null>(null);
  const docs = useDocumentAttachment(
    (entry?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name })),
  );

  const { hours, minutes, hourlyRate } = form.watch();
  const durationMinutes = Number(hours) * 60 + Number(minutes);
  const durationHours = durationMinutes / 60;
  const computedTotal = durationHours > 0 ? (durationHours * Number(hourlyRate)).toFixed(2) : "0.00";
  const totalValue = totalDraft ?? computedTotal;
  const selectedTargetLabel = findTargetLabel(targetTree, targetValue) ?? "Projet";

  function handleTotalChange(value: string) {
    setTotalDraft(value);
    const total = Number(value);
    if (durationHours > 0 && total >= 0 && value !== "") {
      form.setValue("hourlyRate", (total / durationHours).toFixed(2));
    }
  }

  async function handleSubmit(values: EditTimeFormValues) {
    const { folder, task } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit({
      documentIds: docs.getAllDocIds(newDocIds),
      durationMinutes: Number(values.hours) * 60 + Number(values.minutes),
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
              <FieldLabel htmlFor="edit-time-hours">Heures</FieldLabel>
              <Input id="edit-time-hours" type="number" min="0" {...form.register("hours")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-time-minutes">Minutes</FieldLabel>
              <Input id="edit-time-minutes" type="number" min="0" max="59" {...form.register("minutes")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="edit-time-rate">Taux horaire</FieldLabel>
              <Input id="edit-time-rate" type="number" min="0" step="0.01" {...form.register("hourlyRate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-time-total">Total</FieldLabel>
              <Input
                id="edit-time-total"
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
              onSelect={setTargetValue}
              onCreateFolder={onCreateFolder}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-time-description">Description</FieldLabel>
            <Textarea id="edit-time-description" rows={4} {...form.register("description")} />
          </Field>

          <MultiDocumentAttachmentField
            existingDocs={docs.existingDocs}
            pendingFiles={docs.pendingFiles}
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
  folderNameById,
  taskTitleById,
  userNameById,
  canEdit,
  canPay,
  canDelete,
  deletingId,
  onClose,
  onEdit,
  onPay,
  onDelete,
}: {
  entry: TimeEntry | null;
  folderNameById: Map<number, string>;
  taskTitleById: Map<number, string>;
  userNameById: Map<number, string>;
  canEdit: boolean;
  canPay: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  onClose: () => void;
  onEdit: (entry: TimeEntry) => void;
  onPay: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}) {
  if (!entry) return null;

  const paymentStatus = getPaymentStatus(entry);
  const targetLabel = getEntryTargetLabel(entry, folderNameById, taskTitleById);
  const displayName = (entry.user != null ? userNameById.get(entry.user) : null) ?? entry.user_display_name;
  const paidRatio =
    Number(entry.cost_amount) > 0
      ? Math.min(100, (Number(entry.paid_amount) / Number(entry.cost_amount)) * 100)
      : 100;

  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{entry.description || "Temps enregistre"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <PaymentStatusBadge status={paymentStatus} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Utilisateur</p>
              <p className="mt-1 text-sm">{displayName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Date</p>
              <p className="mt-1 text-sm">{formatDateTime(entry.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Cible</p>
              <p className="mt-1 text-sm">{targetLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Duree</p>
              <p className="mt-1 text-sm">{formatDuration(entry.duration_minutes)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Taux horaire</p>
              <p className="mt-1 text-sm">{formatMoney(entry.hourly_rate)}/h</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
              <p className="mt-1 text-sm font-semibold">{formatMoney(entry.cost_amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Paye</p>
              <p className="mt-1 text-sm text-emerald-700">{formatMoney(entry.paid_amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Reste</p>
              <p className={`mt-1 text-sm ${paymentStatus === "paid" ? "text-muted-foreground" : "text-orange-700 font-medium"}`}>
                {paymentStatus === "paid" ? "—" : formatMoney(entry.remaining_amount)}
              </p>
            </div>
          </div>
          {paymentStatus !== "paid" ? (
            <div className="flex items-center gap-2">
              <Progress value={paidRatio} className="h-2" />
              <span className="shrink-0 text-xs text-muted-foreground">{Math.round(paidRatio)}%</span>
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deletingId === entry.id}
              onClick={() => onDelete(entry)}
            >
              <Trash2 className="size-4" />
              {deletingId === entry.id ? "Suppression..." : "Supprimer"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">Fermer</Button>
            </DialogClose>
            {canPay && paymentStatus !== "paid" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onPay(entry)}>
                <CreditCard className="size-4" />
                Payer
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" size="sm" onClick={() => onEdit(entry)}>
                <Pencil className="size-4" />
                Modifier
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
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
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Montant paye</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                max={remainingAmount}
                step="0.01"
                {...form.register("amount")}
              />
            </div>
          ) : null}

          <FormErrorAlert error={error} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isPending || remainingAmount <= 0 || (mode === "partial" && Number(form.watch("amount")) <= 0)}
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
