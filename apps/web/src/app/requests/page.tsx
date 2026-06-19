"use client";

import type { ExpenseRequest, ExpenseRequestPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Clock, FileText, Folder, ListTodo, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EntryDetailBody } from "@/components/ui/entry-detail-body";
import { PageTitle } from "@/components/ui/page-title";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { MultiDocumentAttachmentField } from "@/components/ui/multi-document-attachment-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatDate, formatMoney } from "@/lib/task-utils";
import { parseIdParam } from "@/lib/url-params";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const canView = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestView);
  const canEdit = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestEdit);
  const canDelete = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestDelete);
  const canApprove = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestApprove);
  const projectId = selectedProject?.id ?? null;

  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const userFilterId = parseIdParam(searchParams.get("member"));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ExpenseRequest | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function updateUrlFilter(changes: { status?: string; folder?: number | null; member?: number | null }) {
    if (!selectedProject) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if ("status" in changes) {
      const v = changes.status ?? "all";
      if (v !== "all") params.set("status", v); else params.delete("status");
    }
    if ("folder" in changes) {
      if (changes.folder != null) params.set("folder", String(changes.folder));
      else params.delete("folder");
    }
    if ("member" in changes) {
      if (changes.member != null) params.set("member", String(changes.member));
      else params.delete("member");
    }
    router.replace(`/requests?${params.toString()}`, { scroll: false });
  }

  const requestsQuery = useQuery({
    queryKey: projectId
      ? queryKeys.expenseRequests.list(projectId, {
          status: statusFilter !== "all" ? statusFilter : undefined,
          folder: folderFilterId ?? undefined,
          requestedBy: userFilterId ?? undefined,
        })
      : ["expense-requests", "disabled"],
    queryFn: () => api.expenseRequests.list(projectId!, {
      status: statusFilter !== "all" ? statusFilter : undefined,
      folder: folderFilterId ?? undefined,
      requested_by: userFilterId ?? undefined,
    }),
    enabled: Boolean(projectId && canView),
  });

  const foldersQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(projectId!),
    enabled: Boolean(projectId && canView),
  });

  const targetTreeQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.targetTree(projectId) : ["folders", "target-tree", "disabled"],
    queryFn: () => api.folders.targetTree(projectId!),
    enabled: Boolean(projectId && canEdit),
  });

  const membersQuery = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : ["members", "disabled"],
    queryFn: () => api.members.list(projectId!),
    enabled: Boolean(projectId && canView),
  });

  const createRequest = useMutation({
    mutationFn: (payload: ExpenseRequestPayload) => api.expenseRequests.create(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setCreateOpen(false);
    },
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setEditingRequest(null);
    },
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setDeletingId(null);
    },
  });

  const approveRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
    },
    onError: (err) => setActionError(getErrorMessage(err)),
  });

  const rejectRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
    },
    onError: (err) => setActionError(getErrorMessage(err)),
  });

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: (err) => setActionError(getErrorMessage(err)),
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(projectId!) });
    },
  });

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentId });
  }

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

  const allRequests = normalizeApiList(requestsQuery.data);
  const folders = foldersQuery.data ?? [];
  const targetFolders = targetTreeQuery.data ?? [];
  const members = normalizeApiList(membersQuery.data);

  const search = searchQuery.trim().toLowerCase();
  const requests = search
    ? allRequests.filter((r) =>
        r.title.toLowerCase().includes(search) ||
        (r.category ?? "").toLowerCase().includes(search) ||
        (r.description ?? "").toLowerCase().includes(search),
      )
    : allRequests;

  const folderFilterName = folderFilterId != null ? (findFolderName(folders, folderFilterId) ?? "Dossier") : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Remboursements" title="Demandes de remboursement" />
        {canEdit ? (
          <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouvelle demande
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-nowrap sm:items-center">
        <Select value={statusFilter} onValueChange={(v) => updateUrlFilter({ status: v })}>
          <SelectTrigger className="w-full bg-background sm:flex-1 sm:min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuve</SelectItem>
            <SelectItem value="rejected">Refuse</SelectItem>
          </SelectContent>
        </Select>
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        <div className="w-full sm:flex-1 sm:min-w-0">
          <TreePickerDialog
            mode="folder"
            folders={folders}
            selectedFolderId={folderFilterId}
            buttonLabel={folderFilterName ?? "Tous dossiers"}
            description="Filtrer les demandes par dossier."
            onSelect={(id) => updateUrlFilter({ folder: id })}
            onCreateFolder={canEdit ? handleCreateFolder : undefined}
          />
        </div>
        <Input
          className="w-full bg-background sm:flex-1 sm:min-w-0"
          placeholder="Rechercher…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setSearchQuery("");
            const params = new URLSearchParams({ project: String(selectedProject.id) });
            router.replace(`/requests?${params.toString()}`, { scroll: false });
          }}
        >
          Effacer filtres
        </Button>
      </div>

      <FormErrorAlert error={actionError} />

      {requestsQuery.isLoading ? (
        <SkeletonLoader count={4} className="h-16 w-full rounded-lg" />
      ) : requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune demande de remboursement.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex cursor-pointer items-start gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30"
              onClick={() => setViewingRequest(req)}
            >
              <div className="pt-0.5">
                <RequestStatusBadge status={req.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{req.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(req.amount)}</span>
                </div>
                {req.category || req.description ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {[req.category, req.description].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {req.task_name ? (
                    <span className="inline-flex items-center gap-1">
                      <ListTodo className="size-3 text-sky-600" />
                      {req.task_name}
                    </span>
                  ) : req.folder ? (
                    <span className="inline-flex items-center gap-1">
                      <Folder className="size-3 text-amber-500" />
                      {findFolderName(folders, req.folder) ?? `Dossier #${req.folder}`}
                    </span>
                  ) : null}
                  {(req.documents_info ?? []).length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3" />
                      {req.documents_info[0].name ?? `Document #${req.documents_info[0].id}`}
                      {req.documents_info.length > 1 ? ` +${req.documents_info.length - 1}` : ""}
                    </span>
                  ) : null}
                  {req.requested_by_name ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" />
                      {req.requested_by_name}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0">
                    {formatDate(req.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                {canApprove && req.status === "pending" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={approveRequest.isPending || rejectRequest.isPending}
                      onClick={(e) => { e.stopPropagation(); setActionError(null); approveRequest.mutate(req.id); }}
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
                      onClick={(e) => { e.stopPropagation(); setActionError(null); rejectRequest.mutate(req.id); }}
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
                    onClick={(e) => { e.stopPropagation(); setEditingRequest(req); }}
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
                    onClick={(e) => { e.stopPropagation(); setDeletingId(req.id); }}
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
        targetFolders={targetFolders}
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
        targetFolders={targetFolders}
        isPending={updateRequest.isPending}
        onSubmit={(payload) => editingRequest && updateRequest.mutate({ id: editingRequest.id, payload })}
      />

      <ConfirmDeleteDialog
        open={deletingId != null}
        title="Supprimer la demande"
        isPending={deleteRequest.isPending}
        onConfirm={() => deletingId != null && deleteRequest.mutate(deletingId)}
        onClose={() => setDeletingId(null)}
      />

      <ExpenseRequestDetailDialog
        request={viewingRequest}
        folders={folders}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingRequest(null)}
      />

      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}

function ExpenseRequestFormDialog({
  mode,
  request,
  open,
  onOpenChange,
  projectId,
  targetFolders,
  isPending,
  onSubmit,
}: {
  mode: "create" | "edit";
  request?: ExpenseRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  isPending: boolean;
  onSubmit: (payload: ExpenseRequestPayload) => void;
}) {
  const initialTarget = request?.task != null
    ? `task-${request.task}`
    : request?.folder != null
    ? `folder-${request.folder}`
    : "project";

  function buildInitialDocs() {
    return (request?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name }));
  }

  const [title, setTitle] = useState(request?.title ?? "");
  const [amount, setAmount] = useState(request?.amount ?? "");
  const [category, setCategory] = useState(request?.category ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [existingDocs, setExistingDocs] = useState<Array<{ id: number; name: string | null }>>(buildInitialDocs);
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const targetTree = useMemo(() => buildTargetTree(targetFolders), [targetFolders]);
  const targetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTitle(request?.title ?? "");
      setAmount(request?.amount ?? "");
      setCategory(request?.category ?? "");
      setDescription(request?.description ?? "");
      setTargetValue(initialTarget);
      setExistingDocs(buildInitialDocs());
      setPendingFiles([]);
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    const newDocIds: number[] = [];

    if (pendingFiles.length > 0) {
      setUploading(true);
      const { folder } = getTargetPayload(targetValue);
      try {
        for (const file of pendingFiles) {
          const uploaded: ApiFile = await api.documents.upload(projectId, {
            file,
            folder: folder ?? undefined,
            name: file.name,
          });
          newDocIds.push(uploaded.id);
        }
      } catch (err) {
        setFormError(getErrorMessage(err));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const { folder, task } = getTargetPayload(targetValue);
    onSubmit({
      title: title.trim(),
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
      folder,
      task,
      documents: [...existingDocs.map((d) => d.id), ...newDocIds],
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
            <Label>Cible (optionnel)</Label>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={targetLabel}
              onSelect={setTargetValue}
            />
          </div>

          <MultiDocumentAttachmentField
            existingDocs={existingDocs}
            pendingFiles={pendingFiles}
            onRemoveDoc={(id) => setExistingDocs((prev) => prev.filter((d) => d.id !== id))}
            onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
            onRemoveFile={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
          />

          <FormErrorAlert error={formError} />
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

function ExpenseRequestDetailDialog({
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

function parseStatusFilter(value: string | null): "all" | "pending" | "approved" | "rejected" {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "all";
}

