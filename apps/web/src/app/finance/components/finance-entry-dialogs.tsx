"use client";

import type { FinancialEntry, FinancialEntryPayload, FolderTreeNode } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock, Folder, ListTodo, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntryTypeBadge } from "@/components/badges/entry-type-badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/pickers/tree-picker";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { DetailField, DetailLabel, DetailModal, ModalDocs, ModalFooter, ModalGrid, ModalHero, ModalSection } from "@/components/dialogs/detail-layout";
import { formatDate, formatMoney } from "@/lib/task-utils";

const financeSchema = z.object({
  type: z.enum(["expense", "refund"]),
  amount: z.string().min(1, "Le montant est requis"),
  date: z.string(),
  category: z.string(),
  description: z.string(),
});
type FinanceFormValues = z.infer<typeof financeSchema>;

export function FinancialEntryFormDialog({
  mode,
  entry,
  open,
  onOpenChange,
  projectId,
  targetFolders,
  error,
  isPending,
  onCreateFolder,
  onSubmit,
}: {
  mode: "create" | "edit";
  entry?: FinancialEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  error: string | null;
  isPending: boolean;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: FinancialEntryPayload) => void;
}) {
  const initialTarget = entry?.task != null
    ? `task-${entry.task}`
    : entry?.folder != null
      ? `folder-${entry.folder}`
      : "project";

  const form = useForm<FinanceFormValues>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      type: entry?.type ?? "expense",
      amount: String(entry?.amount ?? ""),
      date: entry?.date ?? new Date().toISOString().split("T")[0],
      category: entry?.category ?? "",
      description: entry?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(initialTarget);
  const docs = useDocumentAttachment(
    (entry?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name })),
  );

  const targetTree = useMemo(() => buildTargetTree(targetFolders), [targetFolders]);
  const targetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      setTargetValue(initialTarget);
      docs.reset();
    }
    onOpenChange(next);
  }

  async function handleSubmit(values: FinanceFormValues) {
    const { folder, task } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit({
      date: values.date || null,
      type: values.type,
      amount: values.amount.replace(",", "."),
      category: values.category.trim() || null,
      description: values.description.trim() || null,
      folder,
      task,
      documents: docs.getAllDocIds(newDocIds),
    });
  }

  const isSubmitting = docs.uploading || isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Ajouter une depense ou un remboursement." : "Modifier les details de cette entree."}
          </DialogDescription>
        </DialogHeader>

        <form id="finance-form" onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
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
              <Input id="entry-amount" type="text" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
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
            <FieldLabel htmlFor="entry-category">Categorie</FieldLabel>
            <Input id="entry-category" type="text" placeholder="Ex: Transport, Materiel…" {...form.register("category")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-description">Description</FieldLabel>
            <Textarea id="entry-description" rows={2} placeholder="Details optionnels…" {...form.register("description")} />
          </Field>

          <Field>
            <FieldLabel>Cible (optionnel)</FieldLabel>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={targetLabel}
              onSelect={setTargetValue}
              onCreateFolder={onCreateFolder}
            />
          </Field>

          <MultiDocumentAttachmentField
            existingDocs={docs.existingDocs}
            pendingFiles={docs.pendingFiles}
            onRemoveDoc={docs.removeExistingDoc}
            onAddFiles={docs.addPendingFiles}
            onRemoveFile={docs.removePendingFile}
          />

          <FormErrorAlert error={docs.uploadError} />
          <FormErrorAlert error={error} />
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="submit" form="finance-form" disabled={isSubmitting}>
            {docs.uploading ? "Upload…" : mode === "create" ? "Creer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinancialEntryDetailDialog({
  entry,
  isOpeningDocument,
  onOpenDocument,
  onClose,
  onTimeEntryClick,
}: {
  entry: FinancialEntry | null;
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
  onTimeEntryClick?: (timeEntryId: number) => void;
}) {
  return (
    <DetailModal
      open={entry != null}
      onClose={onClose}
      title="Detail de l'entree"
      footer={<ModalFooter />}
    >
      {entry ? (
        <>
          <ModalHero>
            <EntryTypeBadge type={entry.type} />
            <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
              {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
            </p>
          </ModalHero>

          {(entry.category != null || entry.description != null || entry.task != null || entry.folder != null) ? (
            <ModalSection>
              {entry.category ? (
                <DetailField label="Categorie">
                  <span className="font-medium">{entry.category}</span>
                </DetailField>
              ) : null}
              {entry.description ? (
                <div>
                  <DetailLabel>Description</DetailLabel>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{entry.description}</p>
                </div>
              ) : null}
              {entry.task != null || entry.folder != null ? (
                <DetailField label="Cible">
                  {entry.task_name ? (
                    <>
                      <ListTodo className="size-4 shrink-0 text-sky-600" />
                      <span className="font-medium">{entry.task_name}</span>
                    </>
                  ) : (
                    <>
                      <Folder className="size-4 shrink-0 text-amber-500" />
                      <span className="font-medium">{entry.folder_name ?? `Dossier #${entry.folder}`}</span>
                    </>
                  )}
                </DetailField>
              ) : null}
            </ModalSection>
          ) : null}

          <ModalGrid>
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

          <ModalDocs
            docs={entry.documents_info ?? []}
            isOpening={isOpeningDocument}
            onOpen={onOpenDocument}
          />
        </>
      ) : null}
    </DetailModal>
  );
}
