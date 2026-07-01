"use client";

import type { ExpenseRequest, ExpenseRequestPayload, FolderTreeNode } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Folder, ListTodo, UserRound } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { MultiDocumentAttachmentField } from "@/components/multi-document-attachment-field";
import { RequestStatusBadge } from "@/components/badges/request-status-badge";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/pickers/tree-picker";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { DetailField, DetailLabel, DetailModal, ModalDocs, ModalFooter, ModalGrid, ModalHero, ModalSection } from "@/components/dialogs/detail-layout";
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
    request?.documents_info ?? [],
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
            projectId={projectId}
            existingDocs={docs.existingDocs}
            pendingFiles={docs.pendingFiles}
            uploading={docs.uploading}
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
  projectId,
  isOpeningDocument,
  onOpenDocument,
  onClose,
}: {
  request: ExpenseRequest | null;
  projectId: number;
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal
      open={request != null}
      onClose={onClose}
      title={request?.title ?? "Detail de la demande"}
      footer={<ModalFooter />}
    >
      {request ? (
        <>
          <ModalHero>
            <RequestStatusBadge status={request.status} />
            <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight">{formatMoney(request.amount)}</p>
          </ModalHero>

          {(request.category != null || request.description != null || request.task != null || request.folder != null) ? (
            <ModalSection>
              {request.category ? (
                <DetailField label="Categorie">
                  <span className="font-medium">{request.category}</span>
                </DetailField>
              ) : null}
              {request.description ? (
                <div>
                  <DetailLabel>Description</DetailLabel>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{request.description}</p>
                </div>
              ) : null}
              {request.task != null || request.folder != null ? (
                <DetailField label="Cible">
                  {request.task_name ? (
                    <>
                      <ListTodo className="size-4 shrink-0 text-sky-600" />
                      <span className="font-medium">{request.task_name}</span>
                    </>
                  ) : (
                    <>
                      <Folder className="size-4 shrink-0 text-amber-500" />
                      <span className="font-medium">{request.folder_name ?? `Dossier #${request.folder}`}</span>
                    </>
                  )}
                </DetailField>
              ) : null}
            </ModalSection>
          ) : null}

          <ModalGrid>
            {request.requested_by_name ? (
              <DetailField label="Demande par" icon={UserRound}>
                <span>{request.requested_by_name}</span>
              </DetailField>
            ) : null}
            <DetailField label="Date" icon={Calendar}>
              <span>{formatDate(request.created_at)}</span>
            </DetailField>
          </ModalGrid>

          <ModalDocs
            docs={request.documents_info ?? []}
            projectId={projectId}
            isOpening={isOpeningDocument}
            onOpen={onOpenDocument}
          />
        </>
      ) : null}
    </DetailModal>
  );
}
