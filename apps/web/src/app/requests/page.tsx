"use client";

import type { ExpenseRequest, ExpenseRequestPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, FileText, Folder, ListTodo, Lock, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSearch, FilterSelect } from "@/components/ui/filter-bar";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { RequestStatusBadge } from "@/components/ui/request-status-badge";
import { SelectItem } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatDate, formatMoney } from "@/lib/task-utils";
import { parseIdParam } from "@/lib/url-params";
import { ExpenseRequestDetailDialog, ExpenseRequestFormDialog } from "./components/request-dialogs";
import { buildRequestsHref, parseStatusFilter } from "./lib/request-utils";

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

function RequestsPageContent({ user, selectedProject, queryClient, openCreateProject }: ProjectWorkspaceState) {
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
      toast.success("Remboursement cree");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    onSuccess: () => {
      toast.success("Remboursement mis a jour");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setEditingRequest(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement supprime");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      setDeletingId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const approveRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement approuve");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement rejete");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "expense-requests"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(projectId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.targetTree(projectId!) }),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentId });
  }

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={ClipboardList}
        description="Cree ou selectionne un projet pour voir les demandes."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canView) {
    return (
      <Empty className="border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Lock className="size-4" /></EmptyMedia>
          <EmptyTitle>Acces restreint</EmptyTitle>
          <EmptyDescription>Vous n&apos;avez pas acces aux demandes de remboursement de ce projet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
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

      <FilterBar>
        <FilterSelect value={statusFilter} onValueChange={(v) => updateUrlFilter({ status: v })}>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="pending">En attente</SelectItem>
          <SelectItem value="approved">Approuvé</SelectItem>
          <SelectItem value="rejected">Refusé</SelectItem>
        </FilterSelect>
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        <FilterFolderPicker
          folders={folders}
          selectedFolderId={folderFilterId}
          buttonLabel={folderFilterName ?? "Tous dossiers"}
          description="Filtrer les demandes par dossier."
          onSelect={(id) => updateUrlFilter({ folder: id })}
          onCreateFolder={canEdit ? handleCreateFolder : undefined}
        />
        <FilterSearch value={searchQuery} onChange={setSearchQuery} />
        <FilterClear path="/requests" removeKeys={["status", "folder", "member"]} onClick={() => setSearchQuery("")} />
      </FilterBar>

      {requestsQuery.isLoading ? (
        <SkeletonLoader count={4} className="h-16 w-full rounded-lg" />
      ) : requests.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Aucune demande de remboursement</EmptyTitle>
            <EmptyDescription>Aucune demande ne correspond aux filtres selectionnes.</EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                      onClick={(e) => { e.stopPropagation(); approveRequest.mutate(req.id); }}
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
                      onClick={(e) => { e.stopPropagation(); rejectRequest.mutate(req.id); }}
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
        onCreateFolder={canEdit ? handleCreateFolder : undefined}
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
        onCreateFolder={canEdit ? handleCreateFolder : undefined}
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
