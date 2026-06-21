"use client";

import type { ExpenseRequest, ExpenseRequestPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { AccessDeniedState } from "@/components/ui/access-denied-state";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EntryMetadataRow } from "@/components/ui/entry-metadata-row";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSearch, FilterSelect, FilterToggle } from "@/components/ui/filter-bar";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { RequestStatusBadge } from "@/components/ui/request-status-badge";
import { SelectItem } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";
import { formatMoney } from "@/lib/task-utils";
import { buildFilterParams, parseIdParam, parseBooleanParam } from "@/lib/url-params";
import { ExpenseRequestDetailDialog, ExpenseRequestFormDialog } from "./components/request-dialogs";
import { buildRequestsHref, parseStatusFilter } from "./lib/request-utils";

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="requests"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildRequestsHref(id, searchParams))}
      onProjectCreated={(project) => router.push(buildRequestsHref(project.id, searchParams))}
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
  const showRejected = parseBooleanParam(searchParams.get("show_rejected"));
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const userFilterId = parseIdParam(searchParams.get("member"));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ExpenseRequest | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function updateUrlFilter(changes: Record<string, string | number | boolean | null | undefined>) {
    if (!selectedProject) return;
    const params = buildFilterParams(searchParams, selectedProject.id, changes);
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
    return <AccessDeniedState description="Vous n'avez pas acces aux demandes de remboursement de ce projet." />;
  }

  const allRequests = normalizeApiList(requestsQuery.data);
  const folders = foldersQuery.data ?? [];
  const targetFolders = targetTreeQuery.data ?? [];
  const members = normalizeApiList(membersQuery.data);
  const folderNameById = useMemo(() => buildFolderNameMap(folders), [folders]);

  const visibleRequests =
    statusFilter === "all" && !showRejected
      ? allRequests.filter((r) => r.status !== "rejected")
      : allRequests;

  const search = searchQuery.trim().toLowerCase();
  const requests = search
    ? visibleRequests.filter((r) =>
        r.title.toLowerCase().includes(search) ||
        (r.category ?? "").toLowerCase().includes(search) ||
        (r.description ?? "").toLowerCase().includes(search),
      )
    : visibleRequests;


  const folderFilterName = folderFilterId != null ? (folderNameById.get(folderFilterId) ?? "Dossier") : null;

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
        {statusFilter === "all" ? (
          <FilterToggle
            pressed={showRejected}
            onPressedChange={(pressed) => updateUrlFilter({ show_rejected: pressed })}
          >
            Inclure refusés
          </FilterToggle>
        ) : null}
        <FilterClear path="/requests" removeKeys={["status", "folder", "member", "show_rejected"]} onClick={() => setSearchQuery("")} />
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
                <EntryMetadataRow
                  taskName={req.task_name}
                  folderId={req.folder}
                  folderName={req.folder ? (folderNameById.get(req.folder) ?? `Dossier #${req.folder}`) : null}
                  documents={req.documents_info}
                  userName={req.requested_by_name}
                  date={req.created_at}
                />
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
