"use client";

import type { ExpenseRequest, ExpenseRequestPayload, FolderTreeNode } from "@project-gestion/types";
import { requestSchema, type RequestFormInput, type RequestFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/forms/money-input";
import { MultiDocumentAttachmentField } from "@/components/documents/multi-document-attachment-field";
import { RequestStatusBadge } from "@/components/badges/request-status-badge";
import { Textarea } from "@/components/ui/textarea";
import { TargetField } from "@/components/pickers/tree-picker";
import { getEntryTarget, getTargetPayload, getTargetValueFromEntry } from "@/lib/target-utils";
import { getErrorMessage } from "@/lib/errors";
import { useDocumentAttachment } from "@/lib/use-document-attachment";
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
import { DetailField, DetailModal, EntryCategorySection, ModalDocs, ModalFooter, ModalGrid, ModalHero } from "@/components/dialogs/detail-layout";
import { formatDate, formatMoney } from "@/lib/task-utils";

export function ExpenseRequestFormDialog({
  mode,
  request,
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
  request?: ExpenseRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  error: unknown;
  isPending: boolean;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: ExpenseRequestPayload) => void;
}) {
  const initialTarget = request ? getTargetValueFromEntry(request) : "project";

  const form = useForm<RequestFormInput, unknown, RequestFormValues>({
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

  useServerFieldErrors(form, error, ["title", "amount", "category", "description"]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      setTargetValue(initialTarget);
      docs.reset();
    }
    onOpenChange(next);
  }

  async function submitForm(values: RequestFormValues) {
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
      title={mode === "create" ? "Nouvelle demande" : "Modifier la demande"}
      description={mode === "create" ? "Creer une demande de remboursement." : "Modifier les details de cette demande."}
      error={docs.uploadError ?? getErrorMessage(error)}
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <FormSubmitButton
            form="request-form"
            pending={isSubmitting}
            disabled={isSubmitting}
            label={mode === "create" ? "Creer" : "Enregistrer"}
            pendingLabel={docs.uploading ? "Upload…" : mode === "create" ? "Creation..." : "Enregistrement..."}
          />
        </>
      }
    >
        <form id="request-form" onSubmit={form.handleSubmit(submitForm)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="req-title">Titre</FieldLabel>
            <Input id="req-title" type="text" placeholder="Ex: Achat materiel bureau" {...form.register("title")} />
            <FieldError errors={[form.formState.errors.title]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="req-amount">Montant (€)</FieldLabel>
              <MoneyInput id="req-amount" {...form.register("amount")} />
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

          <TargetField
            label="Cible (optionnel)"
            folders={targetFolders}
            value={targetValue}
            onChange={setTargetValue}
            onCreateFolder={onCreateFolder}
          />

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
    </FormDialog>
  );
}

export function ExpenseRequestDetailModal({
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

          <EntryCategorySection
            category={request.category}
            description={request.description}
            target={getEntryTarget(request)}
          />

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
