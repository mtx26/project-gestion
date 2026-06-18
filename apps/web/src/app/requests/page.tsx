"use client";

import type { ExpenseRequest, ExpenseRequestPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { DocumentAttachmentField } from "@/components/ui/document-attachment-field";
import { FolderTreePickerDialog } from "@/components/ui/folder-tree-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatMoney } from "@/lib/task-utils";

function buildRequestsHref(projectId: number | string) {
  return `/requests?project=${projectId}`;
}

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="requests"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildRequestsHref(id))}
      onProjectCreated={(project) => router.push(buildRequestsHref(project.id))}
    >
      {(state) => <RequestsPageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function RequestsPageContent({ user, selectedProject, queryClient }: ProjectWorkspaceState) {
  const canView = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestView);
  const canEdit = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestEdit);
  const canDelete = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestDelete);
  const canApprove = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestApprove);
  const projectId = selectedProject?.id ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: projectId ? queryKeys.expenseRequests.list(projectId) : ["expense-requests", "disabled"],
    queryFn: () => api.expenseRequests.list(projectId!),
    enabled: Boolean(projectId && canView),
  });

  const foldersQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(projectId!),
    enabled: Boolean(projectId && canView),
  });

  const createRequest = useMutation({
    mutationFn: (payload: ExpenseRequestPayload) => api.expenseRequests.create(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(projectId!) });
      setCreateOpen(false);
    },
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(projectId!) });
      setEditingRequest(null);
    },
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(projectId!) });
      setDeletingId(null);
    },
  });

  const approveRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(projectId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.list(projectId!) });
    },
    onError: (err) => setActionError(getErrorMessage(err)),
  });

  const rejectRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(projectId!) });
    },
    onError: (err) => setActionError(getErrorMessage(err)),
  });

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p>Selectionnez un projet pour voir les demandes.</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p>Vous n&apos;avez pas acces aux demandes de remboursement de ce projet.</p>
      </div>
    );
  }

  const requests = normalizeApiList(requestsQuery.data);
  const folders = foldersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Remboursements</p>
          <h1 className="mt-1 text-2xl font-semibold">Demandes de remboursement</h1>
        </div>
        {canEdit ? (
          <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouvelle demande
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {requestsQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande de remboursement.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
            >
              <RequestStatusBadge status={req.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{req.title}</span>
                  <span className="tabular-nums text-muted-foreground">{formatMoney(req.amount)}</span>
                  {req.category ? (
                    <span className="truncate text-sm text-muted-foreground">{req.category}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {req.description ? <span className="truncate">{req.description}</span> : null}
                  {req.folder ? (
                    <span className="shrink-0">
                      {findFolderName(folders, req.folder) ?? `Dossier #${req.folder}`}
                    </span>
                  ) : null}
                  {req.document ? (
                    <span className="shrink-0">{req.document_name ?? `Document #${req.document}`}</span>
                  ) : null}
                  <span className="ml-auto shrink-0">
                    {new Date(req.created_at).toLocaleDateString("fr-BE")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {canApprove && req.status === "pending" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={approveRequest.isPending || rejectRequest.isPending}
                      onClick={() => { setActionError(null); approveRequest.mutate(req.id); }}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approuver
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                      disabled={approveRequest.isPending || rejectRequest.isPending}
                      onClick={() => { setActionError(null); rejectRequest.mutate(req.id); }}
                    >
                      <XCircle className="size-3.5" />
                      Refuser
                    </Button>
                  </>
                ) : null}
                {canEdit && req.status === "pending" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingRequest(req)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(req.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExpenseRequestFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId!}
        folders={folders}
        isPending={createRequest.isPending}
        onSubmit={(payload) => createRequest.mutate(payload)}
      />

      <ExpenseRequestFormDialog
        key={editingRequest?.id ?? "edit-none"}
        mode="edit"
        request={editingRequest ?? undefined}
        open={editingRequest != null}
        onOpenChange={(open) => { if (!open) setEditingRequest(null); }}
        projectId={projectId!}
        folders={folders}
        isPending={updateRequest.isPending}
        onSubmit={(payload) => editingRequest && updateRequest.mutate({ id: editingRequest.id, payload })}
      />

      <Dialog open={deletingId != null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la demande</DialogTitle>
            <DialogDescription>Cette action est reversible depuis la corbeille.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRequest.isPending}
              onClick={() => deletingId != null && deleteRequest.mutate(deletingId)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseRequestFormDialog({
  mode,
  request,
  open,
  onOpenChange,
  projectId,
  folders,
  isPending,
  onSubmit,
}: {
  mode: "create" | "edit";
  request?: ExpenseRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  folders: FolderTreeNode[];
  isPending: boolean;
  onSubmit: (payload: ExpenseRequestPayload) => void;
}) {
  const [title, setTitle] = useState(request?.title ?? "");
  const [amount, setAmount] = useState(request?.amount ?? "");
  const [category, setCategory] = useState(request?.category ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [folderId, setFolderId] = useState<number | null>(request?.folder ?? null);
  const [documentId, setDocumentId] = useState<number | null>(request?.document ?? null);
  const [documentFile, setDocumentFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const folderName = findFolderName(folders, folderId);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle(request?.title ?? "");
      setAmount(request?.amount ?? "");
      setCategory(request?.category ?? "");
      setDescription(request?.description ?? "");
      setFolderId(request?.folder ?? null);
      setDocumentId(request?.document ?? null);
      setDocumentFile(null);
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    let resolvedDocumentId = documentId;

    if (documentFile) {
      setUploading(true);
      try {
        const uploaded: ApiFile = await api.documents.upload(projectId, {
          file: documentFile,
          folder: folderId ?? undefined,
          name: documentFile.name,
        });
        resolvedDocumentId = uploaded.id;
      } catch (err) {
        setFormError(getErrorMessage(err));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSubmit({
      title: title.trim(),
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
      folder: folderId,
      document: resolvedDocumentId,
    });
  }

  const isSubmitting = uploading || isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle demande" : "Modifier la demande"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Creer une demande de remboursement."
              : "Modifier les details de cette demande."}
          </DialogDescription>
        </DialogHeader>

        <form id="request-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="req-title">Titre</Label>
            <Input
              id="req-title"
              type="text"
              placeholder="Ex: Achat materiel bureau"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-amount">Montant (€)</Label>
              <Input
                id="req-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-category">Categorie</Label>
              <Input
                id="req-category"
                type="text"
                placeholder="Ex: Transport"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="req-description">Description</Label>
            <Textarea
              id="req-description"
              rows={2}
              placeholder="Details optionnels…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Dossier (optionnel)</Label>
            <FolderTreePickerDialog
              folders={folders}
              selectedFolderId={folderId}
              buttonLabel={folderName ?? "Projet"}
              onSelect={setFolderId}
            />
          </div>

          <DocumentAttachmentField
            documentId={documentId}
            documentName={request?.document_name}
            selectedFile={documentFile}
            onFileChange={setDocumentFile}
            onClearDocument={() => setDocumentId(null)}
          />

          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="submit" form="request-form" disabled={isSubmitting}>
            {uploading ? "Upload…" : mode === "create" ? "Creer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestStatusBadge({ status }: { status: ExpenseRequest["status"] }) {
  if (status === "approved") {
    return (
      <Badge variant="outline" className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="size-3" />
        Approuve
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="shrink-0 gap-1 border-red-200 bg-red-50 text-red-700">
        <XCircle className="size-3" />
        Refuse
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 gap-1 border-yellow-200 bg-yellow-50 text-yellow-700">
      <Clock className="size-3" />
      En attente
    </Badge>
  );
}
