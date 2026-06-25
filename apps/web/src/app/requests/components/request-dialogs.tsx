"use client";

import type { ExpenseRequest, ExpenseRequestPayload, FolderTreeNode } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Eye, FileText, Folder, ListTodo, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { findFolderName } from "@/lib/folder-utils";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { RequestStatusBadge } from "@/components/badges/request-status-badge";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/pickers/tree-picker";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { formatDate, formatMoney } from "@/lib/task-utils";

const requestSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  amount: z.string().min(1, "Le montant est requis"),
  category: z.string(),
  description: z.string(),
});
type RequestFormValues = z.infer<typeof requestSchema>;

export function ExpenseRequestFormDialog({
  mode,
  request,
  open,
  onOpenChange,
  projectId,
  targetFolders,
  isPending,
  onCreateFolder,
  onSubmit,
}: {
  mode: "create" | "edit";
  request?: ExpenseRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  isPending: boolean;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: ExpenseRequestPayload) => void;
}) {
  const initialTarget = request?.task != null
    ? `task-${request.task}`
    : request?.folder != null
      ? `folder-${request.folder}`
      : "project";

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: request?.title ?? "",
      amount: String(request?.amount ?? ""),
      category: request?.category ?? "",
      description: request?.description ?? "",
    },
  });
  const [targetValue, setTargetValue] = useState(initialTarget);
  const docs = useDocumentAttachment(
    (request?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name })),
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

  async function handleSubmit(values: RequestFormValues) {
    const { folder, task } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit({
      title: values.title.trim(),
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
          <DialogTitle>{mode === "create" ? "Nouvelle demande" : "Modifier la demande"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Creer une demande de remboursement." : "Modifier les details de cette demande."}
          </DialogDescription>
        </DialogHeader>

        <form id="request-form" onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="req-title">Titre</FieldLabel>
            <Input id="req-title" type="text" placeholder="Ex: Achat materiel bureau" {...form.register("title")} />
            <FieldError errors={[form.formState.errors.title]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="req-amount">Montant (€)</FieldLabel>
              <Input id="req-amount" type="text" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
              <FieldError errors={[form.formState.errors.amount]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="req-category">Categorie</FieldLabel>
              <Input id="req-category" type="text" placeholder="Ex: Transport" {...form.register("category")} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="req-description">Description</FieldLabel>
            <Textarea id="req-description" rows={2} placeholder="Details optionnels…" {...form.register("description")} />
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
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="submit" form="request-form" disabled={isSubmitting}>
            {docs.uploading ? "Upload…" : mode === "create" ? "Creer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseRequestDetailDialog({
  request,
  folders,
  isOpeningDocument,
  onOpenDocument,
  onClose,
}: {
  request: ExpenseRequest | null;
  folders: FolderTreeNode[];
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={request != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail de la demande</DialogTitle>
        </DialogHeader>
        {request && (
          <div className="divide-y">
            {/* Hero */}
            <div className="pb-5">
              <RequestStatusBadge status={request.status} />
              <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">{formatMoney(request.amount)}</p>
              <p className="mt-2 text-base font-semibold">{request.title}</p>
            </div>

            {/* Details */}
            {(request.category || request.description || request.task_name || request.folder) ? (
              <div className="space-y-4 py-5">
                {request.category ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Categorie</p>
                    <p className="mt-1.5 text-sm font-medium">{request.category}</p>
                  </div>
                ) : null}
                {request.description ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{request.description}</p>
                  </div>
                ) : null}
                {request.task_name || request.folder ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cible</p>
                    {request.task_name ? (
                      <div className="mt-1.5 flex items-center gap-2 text-sm">
                        <ListTodo className="size-4 shrink-0 text-sky-600" />
                        <span className="font-medium">{request.task_name}</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2 text-sm">
                        <Folder className="size-4 shrink-0 text-amber-500" />
                        <span className="font-medium">{findFolderName(folders, request.folder!) ?? `Dossier #${request.folder}`}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 py-5">
              {request.requested_by_name ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Demande par</p>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <span>{request.requested_by_name}</span>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <span>{formatDate(request.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Documents */}
            {(request.documents_info ?? []).length > 0 ? (
              <div className="pt-5">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                <div className="flex flex-col gap-2">
                  {(request.documents_info ?? []).map((doc) => (
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
