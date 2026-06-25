"use client";

import type { FinancialEntry, FinancialEntryPayload, FolderTreeNode } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock, Eye, FileText, Folder, ListTodo, UserRound } from "lucide-react";
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
import { findFolderName } from "@/lib/folder-utils";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/pickers/tree-picker";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
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
  folders,
  isOpeningDocument,
  onOpenDocument,
  onClose,
  onTimeEntryClick,
}: {
  entry: FinancialEntry | null;
  folders: FolderTreeNode[];
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
  onTimeEntryClick?: (timeEntryId: number) => void;
}) {
  return (
    <Dialog open={entry != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail de l&apos;entree</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="divide-y">
            {/* Hero */}
            <div className="pb-5">
              <EntryTypeBadge type={entry.type} />
              <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
                {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
              </p>
            </div>

            {/* Details */}
            {(entry.category || entry.description || entry.task_name || entry.folder) ? (
              <div className="space-y-4 py-5">
                {entry.category ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Categorie</p>
                    <p className="mt-1.5 text-sm font-medium">{entry.category}</p>
                  </div>
                ) : null}
                {entry.description ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{entry.description}</p>
                  </div>
                ) : null}
                {entry.task_name || entry.folder ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cible</p>
                    {entry.task_name ? (
                      <div className="mt-1.5 flex items-center gap-2 text-sm">
                        <ListTodo className="size-4 shrink-0 text-sky-600" />
                        <span className="font-medium">{entry.task_name}</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2 text-sm">
                        <Folder className="size-4 shrink-0 text-amber-500" />
                        <span className="font-medium">{findFolderName(folders, entry.folder!) ?? `Dossier #${entry.folder}`}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 py-5">
              {entry.time_entry_user_name ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pour</p>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <UserRound className="size-4 shrink-0 text-violet-500" />
                    <span>{entry.time_entry_user_name}</span>
                  </div>
                </div>
              ) : entry.created_by_name ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cree par</p>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <span>{entry.created_by_name}</span>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <span>{formatDate(entry.created_at)}</span>
                </div>
              </div>
              {entry.time_entry != null && onTimeEntryClick ? (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Entree de temps</p>
                  <button
                    type="button"
                    className="mt-1.5 flex items-center gap-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => onTimeEntryClick(entry.time_entry!)}
                  >
                    <Clock className="size-4 shrink-0" />
                    Voir le detail
                  </button>
                </div>
              ) : null}
            </div>

            {/* Documents */}
            {(entry.documents_info ?? []).length > 0 ? (
              <div className="pt-5">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                <div className="flex flex-col gap-2">
                  {(entry.documents_info ?? []).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{doc.name ?? `Document #${doc.id}`}</span>
                      <Button type="button" variant="outline" size="sm" disabled={isOpeningDocument} onClick={() => onOpenDocument(doc.id)}>
                        <Eye className="size-3.5" />
                        Apercu
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
