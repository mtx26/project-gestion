"use client";

import type { ExpenseRequest, ExpenseRequestPayload, FolderTreeNode } from "@project-gestion/types";
import { Calendar, UserRound } from "lucide-react";
import React, { useMemo, useState } from "react";
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
import { EntryDetailBody } from "@/components/ui/entry-detail-body";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/ui/multi-document-attachment-field";
import { RequestStatusBadge } from "@/components/ui/request-status-badge";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { formatDate, formatMoney } from "@/lib/task-utils";

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

  const [title, setTitle] = useState(request?.title ?? "");
  const [amount, setAmount] = useState(request?.amount ?? "");
  const [category, setCategory] = useState(request?.category ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [targetValue, setTargetValue] = useState(initialTarget);
  const docs = useDocumentAttachment(
    (request?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name })),
  );

  const targetTree = useMemo(() => buildTargetTree(targetFolders), [targetFolders]);
  const targetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle(request?.title ?? "");
      setAmount(request?.amount ?? "");
      setCategory(request?.category ?? "");
      setDescription(request?.description ?? "");
      setTargetValue(initialTarget);
      docs.reset();
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    const { folder, task } = getTargetPayload(targetValue);
    const newDocIds = await docs.uploadPending(projectId, folder);
    if (newDocIds === null) return;
    onSubmit({
      title: title.trim(),
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
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

        <form id="request-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="req-title">Titre</FieldLabel>
            <Input
              id="req-title"
              type="text"
              placeholder="Ex: Achat materiel bureau"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="req-amount">Montant (€)</FieldLabel>
              <Input
                id="req-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="req-category">Categorie</FieldLabel>
              <Input
                id="req-category"
                type="text"
                placeholder="Ex: Transport"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="req-description">Description</FieldLabel>
            <Textarea
              id="req-description"
              rows={2}
              placeholder="Details optionnels…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail de la demande</DialogTitle>
        </DialogHeader>
        {request && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <RequestStatusBadge status={request.status} />
              <div>
                <p className="font-semibold">{request.title}</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(request.amount)}</p>
              </div>
            </div>

            <EntryDetailBody
              category={request.category}
              description={request.description}
              task_name={request.task_name}
              folder={request.folder}
              documents_info={request.documents_info}
              folders={folders}
              isOpeningDocument={isOpeningDocument}
              onOpenDocument={onOpenDocument}
            />

            <div className="grid grid-cols-2 gap-3 text-sm">
              {request.requested_by_name ? (
                <div>
                  <p className="text-xs text-muted-foreground">Demande par</p>
                  <div className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 text-muted-foreground" />
                    <span>{request.requested_by_name}</span>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>{formatDate(request.created_at)}</span>
                </div>
              </div>
            </div>
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
