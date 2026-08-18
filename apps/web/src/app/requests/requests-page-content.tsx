"use client";

import type { ExpenseRequest, ExpenseRequestPayload, Task } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import {
  buildExpenseRequestsListQuery,
  getApiCount,
  getApiPageSize,
  normalizeApiList,
  type ExpenseRequestListFilters,
} from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Plus, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { DocumentPreviewDialog } from "@/components/dialogs/document-preview-dialog";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { useDocumentPreview } from "@/lib/use-document-preview";
import { EntryMetadataRow } from "@/components/entries/entry-metadata-row";
import { EntryRowActions } from "@/components/entries/entry-row-actions";
import { CollapsibleFilterBar } from "@/components/filters/collapsible-filter-bar";
import { FilterFolderPicker, FilterSearch, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { FilterPeriodPicker } from "@/components/filters/filter-period-picker";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import { EmptyResultsState } from "@/components/states/empty-results-state";
import { ProjectAccessGate } from "@/components/states/project-access-gate";
import { PageHeader } from "@/components/page-title";
import { RequestStatusBadge } from "@/components/badges/request-status-badge";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/task-utils";
import type { EntryTarget } from "@/lib/target-utils";
import { buildProjectHref, omitDefault, parseEnumParam, parseIdParam, parseBooleanParam, parsePageParam } from "@/lib/url-params";
import { PaginationBar } from "@/components/pagination-bar";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useProjectResources } from "@/lib/use-project-resources";
import { useSearchParam } from "@/lib/use-search-param";
import { useUrlFilter } from "@/lib/use-url-filter";
import { ExpenseRequestDetailModal, ExpenseRequestFormDialog } from "./components/request-dialogs";
import { parseStatusFilter } from "./lib/request-filters";

export function RequestsPageContent() {
  return (
    <ProjectWorkspaceShell>
      {(state) => <RequestsView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function RequestsView({ user, selectedProject, projectsQuery, openCreateProject }: ProjectWorkspaceState) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewRequests = can(permissionCodes.expenseRequestView);
  const canEditRequests = can(permissionCodes.expenseRequestEdit);
  const canDeleteRequests = can(permissionCodes.expenseRequestDelete);
  const canApproveRequests = can(permissionCodes.expenseRequestApprove);
  const canViewTasks = can(permissionCodes.taskView);
  const canViewFiles = can(permissionCodes.fileView);
  const projectId = selectedProject?.id ?? null;

  const searchFromUrl = searchParams.get("search") ?? "";
  const dateFrom = searchParams.get("date_from") ?? undefined;
  const dateTo = searchParams.get("date_to") ?? undefined;
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const userFilterId = parseIdParam(searchParams.get("member"));
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const showRejected = parseBooleanParam(searchParams.get("show_rejected"));
  const excludeRejected = !showRejected && statusFilter === "all";
  const ordering = parseEnumParam(searchParams.get("ordering"), ["created_at", "-amount", "amount", "title"] as const, "all");
  const page = parsePageParam(searchParams.get("page"));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ExpenseRequest | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const updateUrlFilter = useUrlFilter("/requests", searchParams, projectId);
  const [searchQuery, handleSearchChange] = useSearchParam(searchFromUrl, updateUrlFilter);
  const { folders, targetFolders, members, folderNameById, handleCreateFolder } =
    useProjectResources(projectId, { canView: canViewRequests, canEdit: canEditRequests, canFetchMembers: canViewRequests });
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const requestFilters: ExpenseRequestListFilters = {
    search: searchFromUrl || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    requestedBy: userFilterId ?? undefined,
    folderId: folderFilterId ?? undefined,
    excludeRejected,
    ordering: ordering !== "all" ? ordering : undefined,
    dateFrom,
    dateTo,
  };

  const requestsQuery = useQuery({
    queryKey: projectId
      ? buildExpenseRequestsListQuery(api, projectId, requestFilters, page).queryKey
      : queryKeys.disabled(),
    queryFn: () => buildExpenseRequestsListQuery(api, projectId!, requestFilters, page).queryFn(),
    enabled: Boolean(projectId && canViewRequests),
    placeholderData: keepPreviousData,
  });

  const createRequest = useCrudMutation({
    mutationFn: (payload: ExpenseRequestPayload) => api.expenseRequests.create(projectId!, payload),
    invalidateKey: queryKeys.expenseRequests.all(projectId!),
    successMessage: "Remboursement cree",
    onSuccess: () => setCreateOpen(false),
  });

  const updateRequest = useCrudMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ExpenseRequestPayload> }) =>
      api.expenseRequests.update(projectId!, id, payload),
    invalidateKey: queryKeys.expenseRequests.all(projectId!),
    successMessage: "Remboursement mis a jour",
    onSuccess: () => setEditingRequest(null),
  });

  const deleteRequest = useCrudMutation({
    mutationFn: (id: number) => api.expenseRequests.remove(projectId!, id),
    invalidateKey: queryKeys.expenseRequests.all(projectId!),
    successMessage: "Remboursement supprime",
    onSuccess: () => {
      setDeletingId(null);
      setViewingRequest(null);
    },
  });

  const approveRequest = useCrudMutation({
    mutationFn: (id: number) => api.expenseRequests.approve(projectId!, id),
    invalidateKey: [queryKeys.expenseRequests.all(projectId!), queryKeys.financialEntries.all(projectId!)],
    successMessage: "Remboursement approuve",
    onSuccess: () => setViewingRequest(null),
  });

  const rejectRequest = useCrudMutation({
    mutationFn: (id: number) => api.expenseRequests.reject(projectId!, id),
    invalidateKey: queryKeys.expenseRequests.all(projectId!),
    successMessage: "Remboursement rejete",
    onSuccess: () => setViewingRequest(null),
  });

  const openTask = useCrudMutation({
    mutationFn: (taskId: number) => api.tasks.get(projectId!, taskId),
    errorMessage: "Impossible de charger la tache",
    onSuccess: setViewingTask,
  });

  function handleTargetClick(target: EntryTarget) {
    if (!projectId) return;
    setViewingRequest(null);
    if (target.type === "task") {
      openTask.mutate(target.id);
    } else {
      router.push(buildProjectHref("/files", projectId));
    }
  }

  if (projectsQuery.isLoading || !selectedProject || !canViewRequests) {
    return (
      <ProjectAccessGate
        isLoadingProjects={projectsQuery.isLoading}
        hasProject={Boolean(selectedProject)}
        hasAccess={canViewRequests}
        icon={ClipboardList}
        noProjectDescription="Cree ou selectionne un projet pour voir les demandes."
        accessDeniedDescription="Vous n'avez pas acces aux demandes de remboursement de ce projet."
        onCreateProject={openCreateProject}
      />
    );
  }

  const requests = normalizeApiList(requestsQuery.data);
  const totalCount = getApiCount(requestsQuery.data);
  const folderFilterName = folderFilterId != null ? (folderNameById.get(folderFilterId) ?? "Dossier") : null;

  return (
    <div className="space-y-5">
      <PageHeader category="Remboursements" title="Demandes de remboursement">
        {canEditRequests ? (
          <Button type="button" className="gap-2" onClick={() => { createRequest.reset(); setCreateOpen(true); }}>
            <Plus className="size-4" />
            Nouvelle demande
          </Button>
        ) : null}
      </PageHeader>

      <CollapsibleFilterBar
        primary={<FilterSearch value={searchQuery} onChange={handleSearchChange} />}
        activeCount={[Boolean(dateFrom), statusFilter !== "all", userFilterId !== null, folderFilterId !== null, showRejected && statusFilter === "all", ordering !== "all"].filter(Boolean).length}
        clearPath="/requests"
        clearKeys={["search", "date_from", "date_to", "status", "member", "folder", "show_rejected", "ordering", "page"]}
      >
        <FilterPeriodPicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(v) => updateUrlFilter({ date_from: v.date_from, date_to: v.date_to })}
        />
        <FilterSelect value={statusFilter} onValueChange={(v) => updateUrlFilter({ status: omitDefault(v, "all") })}>
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
          onCreateFolderAction={canEditRequests ? handleCreateFolder : undefined}
        />
        {statusFilter === "all" ? (
          <FilterToggle pressed={showRejected} onPressedChange={(pressed) => updateUrlFilter({ show_rejected: pressed })}>
            Inclure refusés
          </FilterToggle>
        ) : null}
        <FilterSelect value={ordering} onValueChange={(v) => updateUrlFilter({ ordering: omitDefault(v, "all") })}>
          <SelectItem value="all">Date récente</SelectItem>
          <SelectItem value="created_at">Date ancienne</SelectItem>
          <SelectItem value="-amount">Montant ↓</SelectItem>
          <SelectItem value="amount">Montant ↑</SelectItem>
          <SelectItem value="title">Titre A→Z</SelectItem>
        </FilterSelect>
      </CollapsibleFilterBar>

      {requestsQuery.isLoading ? (
        <SkeletonLoader count={4} className="h-16 w-full rounded-lg" />
      ) : requests.length === 0 ? (
        <EmptyResultsState
          title="Aucune demande de remboursement"
          description="Aucune demande ne correspond aux filtres selectionnes."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-4"
              onClick={() => setViewingRequest(req)}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                <div className="sm:pt-0.5">
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
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap">
                {canApproveRequests && req.status === "pending" ? (() => {
                  const isApprovingThis = approveRequest.isPending && approveRequest.variables === req.id;
                  const isRejectingThis = rejectRequest.isPending && rejectRequest.variables === req.id;
                  return (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={approveRequest.isPending || rejectRequest.isPending}
                        onClick={(e) => { e.stopPropagation(); approveRequest.mutate(req.id); }}
                      >
                        {isApprovingThis ? <Spinner /> : <CheckCircle2 className="size-3.5" />}
                        {isApprovingThis ? "Approbation..." : "Approuver"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
                        disabled={approveRequest.isPending || rejectRequest.isPending}
                        onClick={(e) => { e.stopPropagation(); rejectRequest.mutate(req.id); }}
                      >
                        {isRejectingThis ? <Spinner /> : <XCircle className="size-3.5" />}
                        {isRejectingThis ? "Refus..." : "Refuser"}
                      </Button>
                    </>
                  );
                })() : null}
                <EntryRowActions
                  entryLabel={req.title}
                  canEdit={canEditRequests && req.status === "pending"}
                  canDelete={canDeleteRequests}
                  onEdit={() => { updateRequest.reset(); setEditingRequest(req); }}
                  onDelete={() => setDeletingId(req.id)}
                />
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
        onOpenChange={(open) => { setCreateOpen(open); if (!open) createRequest.reset(); }}
        projectId={projectId!}
        targetFolders={targetFolders}
        error={createRequest.error}
        isPending={createRequest.isPending}
        onCreateFolderAction={canEditRequests ? handleCreateFolder : undefined}
        onSubmit={(payload) => createRequest.mutate(payload)}
      />
      <ExpenseRequestFormDialog
        key={editingRequest?.id ?? "edit-none"}
        mode="edit"
        request={editingRequest ?? undefined}
        open={editingRequest != null}
        onOpenChange={(open) => { if (!open) { setEditingRequest(null); updateRequest.reset(); } }}
        projectId={projectId!}
        targetFolders={targetFolders}
        error={updateRequest.error}
        isPending={updateRequest.isPending}
        onCreateFolderAction={canEditRequests ? handleCreateFolder : undefined}
        onSubmit={(payload) => editingRequest && updateRequest.mutate({ id: editingRequest.id, payload })}
      />
      <ConfirmDeleteDialog
        open={deletingId != null}
        title="Supprimer la demande"
        isPending={deleteRequest.isPending}
        onConfirm={() => deletingId != null && deleteRequest.mutate(deletingId)}
        onClose={() => setDeletingId(null)}
      />
      <ExpenseRequestDetailModal
        request={viewingRequest}
        projectId={projectId!}
        canEdit={canEditRequests && viewingRequest?.status === "pending"}
        canDelete={canDeleteRequests}
        deletingId={deleteRequest.isPending ? deleteRequest.variables : null}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingRequest(null)}
        onEdit={(request) => { setViewingRequest(null); updateRequest.reset(); setEditingRequest(request); }}
        onDelete={(request) => { setViewingRequest(null); setDeletingId(request.id); }}
        canViewTaskTarget={canViewTasks}
        canViewFolderTarget={canViewFiles}
        onTargetClick={handleTargetClick}
      />
      <TaskDetailModal
        task={viewingTask}
        projectId={projectId!}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingTask(null)}
      />
      <DocumentPreviewDialog
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}
