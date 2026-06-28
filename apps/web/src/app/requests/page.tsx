"use client";

import type { ExpenseRequest, ExpenseRequestPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { DocumentPreviewModal } from "@/components/dialogs/document-preview-modal";
import { useDocumentPreview } from "@/lib/use-document-preview";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EntryMetadataRow } from "@/components/entries/entry-metadata-row";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSearch, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { RequestStatusBadge } from "@/components/badges/request-status-badge";
import { SelectItem } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { formatMoney } from "@/lib/task-utils";
import { buildProjectHref, parseEnumParam, parseIdParam, parseBooleanParam, parsePageParam } from "@/lib/url-params";
import { PaginationBar } from "@/components/pagination-bar";
import { useProjectResources } from "@/lib/use-project-resources";
import { useSearchParam } from "@/lib/use-search-param";
import { useUrlFilter } from "@/lib/use-url-filter";
import { ExpenseRequestDetailDialog, ExpenseRequestFormDialog } from "./components/request-dialogs";
import { parseStatusFilter } from "./lib/request-utils";

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="requests"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/requests", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/requests", project.id, searchParams))}
    >
      {(state) => <RequestsPageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function RequestsPageContent({ user, selectedProject, openCreateProject }: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const canViewRequests = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestView);
  const canEditRequests = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestEdit);
  const canDeleteRequests = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestDelete);
  const canApproveRequests = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.expenseRequestApprove);
  const projectId = selectedProject?.id ?? null;

  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const showRejected = parseBooleanParam(searchParams.get("show_rejected"));
  const excludeRejected = !showRejected && statusFilter === "all";
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const userFilterId = parseIdParam(searchParams.get("member"));
  const ordering = parseEnumParam(searchParams.get("ordering"), ["created_at", "-amount", "amount", "title"] as const, "all");
  const page = parsePageParam(searchParams.get("page"));
  const searchFromUrl = searchParams.get("search") ?? "";

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ExpenseRequest | null>(null);
  const updateUrlFilter = useUrlFilter("/requests", searchParams, projectId);
  const [searchQuery, handleSearchChange] = useSearchParam(searchFromUrl, updateUrlFilter);
  const { folders, targetFolders, members, folderNameById, handleCreateFolder } =
    useProjectResources(projectId, { canView: canViewRequests, canEdit: canEditRequests });
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const requestsQuery = useQuery({
    queryKey: projectId
      ? queryKeys.expenseRequests.list(projectId, {
          status: statusFilter !== "all" ? statusFilter : undefined,
          folder: folderFilterId ?? undefined,
          requestedBy: userFilterId ?? undefined,
          excludeRejected,
          ordering: ordering !== "all" ? ordering : undefined,
          page,
          search: searchFromUrl || undefined,
        })
      : ["expense-requests", "disabled"],
    queryFn: () => api.expenseRequests.list(projectId!, {
      status: statusFilter !== "all" ? statusFilter : undefined,
      folder: folderFilterId ?? undefined,
      requested_by: userFilterId ?? undefined,
      exclude_rejected: excludeRejected || undefined,
      ordering: ordering !== "all" ? ordering : undefined,
      page,
      search: searchFromUrl || undefined,
    }),
    enabled: Boolean(projectId && canViewRequests),
    placeholderData: keepPreviousData,
  });

  const createRequest = useMutation({
    mutationFn: (payload: ExpenseRequestPayload) => api.expenseRequests.create(projectId!, payload),
    onSuccess: () => {
      toast.success("Remboursement cree");
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
      setCreateOpen(false);
    },
    onError: toastError,
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    onSuccess: () => {
      toast.success("Remboursement mis a jour");
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
      setEditingRequest(null);
    },
    onError: toastError,
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement supprime");
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
      setDeletingId(null);
    },
    onError: toastError,
  });

  const approveRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement approuve");
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
    },
    onError: toastError,
  });

  const rejectRequest = useMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    onSuccess: () => {
      toast.success("Remboursement rejete");
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests.all(projectId!) });
    },
    onError: toastError,
  });

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={ClipboardList}
        description="Cree ou selectionne un projet pour voir les demandes."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewRequests) {
    return <AccessDeniedState description="Vous n'avez pas acces aux demandes de remboursement de ce projet." />;
  }

  const requests = normalizeApiList(requestsQuery.data);
  const totalCount = getApiCount(requestsQuery.data);
  const folderFilterName = folderFilterId != null ? (folderNameById.get(folderFilterId) ?? "Dossier") : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Remboursements" title="Demandes de remboursement" />
        {canEditRequests ? (
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
          currentUserId={user?.id ?? null}
          selfLabel="Mes demandes"
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        <FilterFolderPicker
          folders={folders}
          selectedFolderId={folderFilterId}
          buttonLabel={folderFilterName ?? "Tous dossiers"}
          description="Filtrer les demandes par dossier."
          onSelect={(id) => updateUrlFilter({ folder: id })}
          onCreateFolder={canEditRequests ? handleCreateFolder : undefined}
        />
        <FilterSearch value={searchQuery} onChange={handleSearchChange} />
        <FilterSelect value={ordering} onValueChange={(v) => updateUrlFilter({ ordering: v })}>
          <SelectItem value="all">Date récente</SelectItem>
          <SelectItem value="created_at">Date ancienne</SelectItem>
          <SelectItem value="-amount">Montant ↓</SelectItem>
          <SelectItem value="amount">Montant ↑</SelectItem>
          <SelectItem value="title">Titre A→Z</SelectItem>
        </FilterSelect>
        {statusFilter === "all" ? (
          <FilterToggle
            pressed={showRejected}
            onPressedChange={(pressed) => updateUrlFilter({ show_rejected: pressed })}
          >
            Inclure refusés
          </FilterToggle>
        ) : null}
        <FilterClear path="/requests" removeKeys={["status", "folder", "member", "show_rejected", "ordering", "page", "search"]} />
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
        <>
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
                  taskId={req.task}
                  taskName={req.task_name}
                  folderId={req.folder}
                  folderName={req.folder_name ?? (req.folder ? `Dossier #${req.folder}` : null)}
                  documents={req.documents_info}
                  userName={req.requested_by_name}
                  date={req.created_at}
                />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                {canApproveRequests && req.status === "pending" ? (
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
                {canEditRequests && req.status === "pending" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); setEditingRequest(req); }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {canDeleteRequests ? (
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
          <PaginationBar count={totalCount} page={page} pageSize={getApiPageSize(requestsQuery.data)} onPageChange={(p) => updateUrlFilter({ page: p })} />
        </>
      )}

      <ExpenseRequestFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId!}
        targetFolders={targetFolders}
        isPending={createRequest.isPending}
        onCreateFolder={canEditRequests ? handleCreateFolder : undefined}
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
        onCreateFolder={canEditRequests ? handleCreateFolder : undefined}
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
