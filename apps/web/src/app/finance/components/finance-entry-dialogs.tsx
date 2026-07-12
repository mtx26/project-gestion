"use client";

import type { FinancialEntry, FinancialEntryPayload, FolderTreeNode } from "@project-gestion/types";
import { financeSchema, type FinanceFormInput, type FinanceFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock, Pencil, UserRound } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import { DialogClose } from "@/components/ui/dialog";
import { EntryTypeBadge } from "@/components/badges/entry-type-badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSection } from "@/components/dialogs/form-section";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { MoneyInput } from "@/components/forms/money-input";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TargetField, TreeIcon } from "@/components/pickers/tree-picker";
import { getEntryTarget, getTargetPayload, getTargetValueFromEntry } from "@/lib/target-utils";
import { getErrorMessage } from "@/lib/errors";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { DetailField, DetailLabel, DetailModal, ModalDocs, ModalFooter, ModalGrid, ModalHero } from "@/components/dialogs/detail-layout";
import { FINANCIAL_SOURCE_LABELS } from "@/lib/finance-chart-utils";
import { formatDate, formatMoney } from "@/lib/task-utils";

export function FinancialEntryFormDialog({
  mode,
  entry,
  open,
  onOpenChange,
  projectId,
  targetFolders,
  error,
  isPending,
  onCreateFolderAction,
  onSubmit,
}: {
  mode: "create" | "edit";
  entry?: FinancialEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  error: unknown;
  isPending: boolean;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: FinancialEntryPayload) => void;
}) {
  const initialTarget = entry ? getTargetValueFromEntry(entry) : "project";

  const form = useForm<FinanceFormInput, unknown, FinanceFormValues>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      type: entry?.type ?? "expense",
      amount: String(entry?.amount ?? ""),
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      description: entry?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(initialTarget);
  const docs = useDocumentAttachment(
    entry?.documents_info ?? [],
  );

  useServerFieldErrors(form, error, ["type", "amount", "date", "description"]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      setTargetValue(initialTarget);
      docs.reset();
    }
    onOpenChange(next);
  }

  async function submitForm(values: FinanceFormValues) {
    const { folder, task } = getTargetPayload(targetValue);
    const documentIds = await docs.resolveDocumentIds(projectId, folder);
    if (documentIds === null) return;
    onSubmit({ ...values, folder, task, documents: documentIds });
  }

  const isSubmitting = docs.uploading || isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}
      description={mode === "create" ? "Ajouter une depense ou un remboursement." : "Modifier les details de cette entree."}
      error={docs.uploadError ?? getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="finance-form"
            pending={isSubmitting}
            disabled={isSubmitting}
            label={mode === "create" ? "Creer" : "Enregistrer"}
            pendingLabel={docs.uploading ? "Upload…" : mode === "create" ? "Creation..." : "Enregistrement..."}
          />
        </>
      }
    >
        <form id="finance-form" onSubmit={form.handleSubmit(submitForm)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="entry-type">Type</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="entry-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Depense</SelectItem>
                      <SelectItem value="refund">Remboursement</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="entry-amount">Montant (€)</FieldLabel>
              <MoneyInput id="entry-amount" {...form.register("amount")} />
              <FieldError errors={[form.formState.errors.amount]} />
            </Field>
          </div>

          <Field>
            <FieldLabel>Date</FieldLabel>
            <Controller
              control={form.control}
              name="date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-description">Description</FieldLabel>
            <Textarea id="entry-description" rows={2} placeholder="Details optionnels…" {...form.register("description")} />
          </Field>

          <TargetField
            label="Cible (optionnel)"
            folders={targetFolders}
            value={targetValue}
            onChange={setTargetValue}
            onCreateFolderAction={onCreateFolderAction}
          />

          <FormSection title="Pieces jointes">
            <MultiDocumentAttachmentField
              projectId={projectId}
              existingDocs={docs.existingDocs}
              pendingFiles={docs.pendingFiles}
              uploading={docs.uploading}
              onRemoveDoc={docs.removeExistingDoc}
              onAddFiles={docs.addPendingFiles}
              onRemoveFile={docs.removePendingFile}
            />
          </FormSection>
        </form>
    </FormDialog>
  );
}

export function FinancialEntryDetailModal({
  entry,
  projectId,
  canEdit = false,
  canDelete = false,
  deletingId,
  isOpeningDocument,
  onOpenDocument,
  onClose,
  onEdit,
  onDelete,
  onTimeEntryClick,
}: {
  entry: FinancialEntry | null;
  projectId: number;
  canEdit?: boolean;
  canDelete?: boolean;
  deletingId?: number | null;
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
  onEdit?: (entry: FinancialEntry) => void;
  onDelete?: (entry: FinancialEntry) => void;
  onTimeEntryClick?: (timeEntryId: number) => void;
}) {
  const target = entry ? getEntryTarget(entry) : null;

  return (
    <DetailModal
      open={entry != null}
      onClose={onClose}
      title="Detail de l'entree"
      footer={
        <ModalFooter
          destructive={
            canDelete && entry && onDelete
              ? {
                  label: deletingId === entry.id ? "Suppression..." : "Supprimer",
                  onClick: () => onDelete(entry),
                  disabled: deletingId === entry.id,
                }
              : undefined
          }
          actions={
            canEdit && entry && onEdit ? (
              <Button type="button" size="sm" onClick={() => onEdit(entry)}>
                <Pencil className="size-4" />
                Modifier
              </Button>
            ) : undefined
          }
        />
      }
    >
      {entry ? (
        <>
          <ModalHero>
            <EntryTypeBadge type={entry.type} />
            <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
              {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
            </p>
          </ModalHero>

          <ModalGrid>
            <DetailField label="Categorie">
              <span className="font-medium">{FINANCIAL_SOURCE_LABELS[entry.source]}</span>
            </DetailField>
            {entry.time_entry_user_name ? (
              <DetailField label="Pour" icon={UserRound} iconClassName="text-violet-500">
                <span>{entry.time_entry_user_name}</span>
              </DetailField>
            ) : entry.created_by_name ? (
              <DetailField label="Cree par" icon={UserRound}>
                <span>{entry.created_by_name}</span>
              </DetailField>
            ) : null}
            <DetailField label="Date" icon={Calendar}>
              <span>{formatDate(entry.created_at)}</span>
            </DetailField>
            {target ? (
              <DetailField label="Cible" className="col-span-2">
                <TreeIcon type={target.type} />
                <span className="font-medium">{target.name ?? `${target.type === "task" ? "Tache" : "Dossier"} #${target.id}`}</span>
              </DetailField>
            ) : null}
            {entry.time_entry != null && onTimeEntryClick ? (
              <DetailField label="Entree de temps" className="col-span-2">
                <button
                  type="button"
                  className="flex items-center gap-2 font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => onTimeEntryClick(entry.time_entry!)}
                >
                  <Clock className="size-4 shrink-0" />
                  Voir le detail
                </button>
              </DetailField>
            ) : null}
          </ModalGrid>

          {entry.description ? (
            <div className="pt-5">
              <DetailLabel>Description</DetailLabel>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{entry.description}</p>
            </div>
          ) : null}

          <ModalDocs
            docs={entry.documents_info ?? []}
            projectId={projectId}
            isOpening={isOpeningDocument}
            onOpen={onOpenDocument}
          />
        </>
      ) : null}
    </DetailModal>
  );
}
