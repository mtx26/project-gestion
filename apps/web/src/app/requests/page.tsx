"use client";

import type { ExpenseRequest, ExpenseRequestPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileText, Folder, ListTodo, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [folderFilterId, setFolderFilterId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | number>("all");

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

  const allRequests = normalizeApiList(requestsQuery.data);
  const folders = foldersQuery.data ?? [];
  const targetFolders = targetTreeQuery.data ?? [];
  const members = normalizeApiList(membersQuery.data);

  const search = searchQuery.trim().toLowerCase();
  const requests = allRequests
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => folderFilterId == null || r.folder === folderFilterId)
    .filter((r) => userFilter === "all" || r.requested_by === userFilter)
    .filter((r) =>
      !search ||
      r.title.toLowerCase().includes(search) ||
      (r.category ?? "").toLowerCase().includes(search) ||
      (r.description ?? "").toLowerCase().includes(search),
    );

  const folderFilterName = folderFilterId != null ? (findFolderName(folders, folderFilterId) ?? "Dossier") : null;
  const hasFilters = statusFilter !== "all" || folderFilterId != null || searchQuery.trim() !== "" || userFilter !== "all";

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

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="w-full bg-background sm:w-56"
          placeholder="Rechercher…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="w-full sm:w-48">
          <TreePickerDialog
            mode="folder"
            folders={folders}
            selectedFolderId={folderFilterId}
            buttonLabel={folderFilterName ?? "Tous dossiers"}
            description="Filtrer les demandes par dossier."
            onSelect={(id) => setFolderFilterId(id)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full bg-background sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuve</SelectItem>
            <SelectItem value="rejected">Refuse</SelectItem>
          </SelectContent>
        </Select>
        {members.length > 0 ? (
          <Select value={String(userFilter)} onValueChange={(v) => setUserFilter(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-full bg-background sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les membres</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.user)}>{m.user_display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter("all"); setFolderFilterId(null); setSearchQuery(""); setUserFilter("all"); }}
          >
            Effacer filtres
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
              className="flex items-start gap-4 rounded-lg border bg-card px-4 py-3"
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
                  {req.document ? (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3" />
                      {req.document_name ?? `Document #${req.document}`}
                    </span>
                  ) : null}
                  {req.requested_by_name ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" />
                      {req.requested_by_name}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0">
                    {new Date(req.created_at).toLocaleDateString("fr-BE")}
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

  const [title, setTitle] = useState(request?.title ?? "");
  const [amount, setAmount] = useState(request?.amount ?? "");
  const [category, setCategory] = useState(request?.category ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [documentId, setDocumentId] = useState<number | null>(request?.document ?? null);
  const [documentFile, setDocumentFile] = useState<globalThis.File | null>(null);
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
      const { folder } = getTargetPayload(targetValue);
      try {
        const uploaded: ApiFile = await api.documents.upload(projectId, {
          file: documentFile,
          folder: folder ?? undefined,
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

    const { folder, task } = getTargetPayload(targetValue);
    onSubmit({
      title: title.trim(),
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
      folder,
      task,
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
            <Label>Cible (optionnel)</Label>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={targetLabel}
              onSelect={setTargetValue}
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
