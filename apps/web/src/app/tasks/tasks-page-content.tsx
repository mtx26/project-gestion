"use client";

import type { Task, TaskPayload } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, UserCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { CollapsibleFilterBar } from "@/components/filters/collapsible-filter-bar";
import { FilterFolderPicker, FilterSearch, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { FilterPeriodPicker } from "@/components/filters/filter-period-picker";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import { EmptyResultsState } from "@/components/states/empty-results-state";
import { ProjectAccessGate } from "@/components/states/project-access-gate";
import { PageHeader } from "@/components/page-title";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { DocumentPreviewDialog } from "@/components/dialogs/document-preview-dialog";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { parseBooleanParam, parseIdParam, parsePageParam } from "@/lib/url-params";
import { PaginationBar } from "@/components/pagination-bar";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { useDocumentPreview } from "@/lib/use-document-preview";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useProjectResources } from "@/lib/use-project-resources";
import { useSearchParam } from "@/lib/use-search-param";
import { useUrlFilter } from "@/lib/use-url-filter";
import { TaskFormDialog } from "./components/task-form-dialog";
import { TaskTable } from "./components/task-table";
import {
  type PriorityFilter,
  type StatusFilter,
  getFolderId,
  parseFolderFilter,
  parsePriorityFilter,
  parseStatusFilter,
} from "./lib/task-filters";

export function TasksPageContent() {
  return (
    <ProjectWorkspaceShell>
      {(state) => <TasksView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function TasksView({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
}: ProjectWorkspaceState) {
  const searchParams = useSearchParams();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewTasks = can(permissionCodes.taskView);
  const canEditTasks = can(permissionCodes.taskEdit);
  const canDeleteTasks = can(permissionCodes.taskDelete);
  const canViewFiles = can(permissionCodes.fileView);
  const projectId = selectedProject?.id ?? null;
  const searchFromUrl = searchParams.get("search") ?? "";
  const dateFrom = searchParams.get("date_from") ?? undefined;
  const dateTo = searchParams.get("date_to") ?? undefined;
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const priorityFilter = parsePriorityFilter(searchParams.get("priority"));
  const createdByFilter = parseIdParam(searchParams.get("member"));
  const folderFilter = parseFolderFilter(searchParams.get("folder"));
  const folderId = getFolderId(folderFilter);
  const includeCompleted = parseBooleanParam(searchParams.get("include_completed"));
  const excludeDone = !includeCompleted && statusFilter === "all";
  const page = parsePageParam(searchParams.get("page"));
  const sortField = searchParams.get("sort") ?? "";
  const sortDir = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";
  const ordering = sortField ? `${sortDir === "desc" ? "-" : ""}${sortField}` : undefined;

  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get("new") === "1");
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const updateUrlFilter = useUrlFilter("/tasks", searchParams, projectId);
  const [searchQuery, handleSearchChange] = useSearchParam(searchFromUrl, updateUrlFilter);
  const { folders, members, folderNameById, handleCreateFolder } = useProjectResources(
    projectId,
    { canView: canViewFiles, canEdit: false, canFetchMembers: canViewTasks },
  );

  const tasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, {
          search: searchFromUrl || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          createdBy: createdByFilter ?? undefined,
          folderId: folderId ?? undefined,
          excludeDone: excludeDone || undefined,
          ordering,
          page,
          dateFrom: dateFrom,
          dateTo: dateTo,
        })
      : queryKeys.disabled(),
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        search: searchFromUrl || undefined,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
        ...(createdByFilter == null ? {} : { created_by: createdByFilter }),
        ...(folderId == null ? {} : { folder: folderId }),
        exclude_done: excludeDone || undefined,
        ordering,
        page,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    enabled: Boolean(projectId && canViewTasks),
    placeholderData: keepPreviousData,
  });

  const myTasksQuery = useQuery({
    queryKey: selectedProject && user
      ? queryKeys.tasks.list(selectedProject.id, {
          search: searchFromUrl || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          assignedTo: user.id,
          folderId: folderId ?? undefined,
          excludeDone: excludeDone || undefined,
          ordering,
          dateFrom: dateFrom,
          dateTo: dateTo,
        })
      : queryKeys.disabled(),
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        search: searchFromUrl || undefined,
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
        assigned_to: user!.id,
        ...(folderId == null ? {} : { folder: folderId }),
        exclude_done: excludeDone || undefined,
        ordering,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    enabled: Boolean(projectId && canViewTasks && !!user),
    placeholderData: keepPreviousData,
  });

  const tasks = normalizeApiList(tasksQuery.data);
  const totalCount = getApiCount(tasksQuery.data);
  const myTasks = normalizeApiList(myTasksQuery.data);

  const createTask = useCrudMutation({
    mutationFn: (payload: TaskPayload) => api.tasks.create(selectedProject!.id, payload),
    invalidateKey: queryKeys.tasks.all(projectId ?? 0),
    successMessage: "Tache creee",
    onSuccess: () => setCreateDialogOpen(false),
  });
  const updateTask = useCrudMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      api.tasks.update(selectedProject!.id, taskId, payload),
    invalidateKey: queryKeys.tasks.all(projectId ?? 0),
    successMessage: "Tache mise a jour",
    onSuccess: () => setEditingTask(null),
  });
  const deleteTask = useCrudMutation({
    mutationFn: (taskId: number) => api.tasks.remove(selectedProject!.id, taskId),
    invalidateKey: queryKeys.tasks.all(projectId ?? 0),
    successMessage: "Tache supprimee",
    onSuccess: () => setDeletingTask(null),
  });

  /** Deliberately not optimistic (unlike notifications' mark-as-read): a status
   * change here would need to patch both `tasksQuery` and `myTasksQuery` — two
   * independently filtered caches for the same resource — and a mismatched
   * rollback across both is an easy way to leave the UI in a wrong state. */
  function handleStatusChange(task: Task, status: Task["status"]) {
    const payload: Partial<TaskPayload> = { status };
    if (status === "in_progress" && !task.start_date) {
      payload.start_date = new Date().toISOString();
    }
    updateTask.mutate({ taskId: task.id, payload });
  }

  if (projectsQuery.isLoading || !selectedProject || !canViewTasks) {
    return (
      <ProjectAccessGate
        isLoadingProjects={projectsQuery.isLoading}
        hasProject={Boolean(selectedProject)}
        hasAccess={canViewTasks}
        icon={Check}
        noProjectDescription="Cree ou selectionne un projet pour gerer les taches."
        accessDeniedDescription="Ton role ne permet pas de voir les taches de ce projet."
        onCreateProject={openCreateProject}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader category="Taches" title="Gestion du travail">
        {canEditTasks ? (
          <Button type="button" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            Nouvelle tache
          </Button>
        ) : null}
      </PageHeader>

      <CollapsibleFilterBar
        primary={<FilterSearch value={searchQuery} onChange={handleSearchChange} />}
        activeCount={[Boolean(dateFrom), statusFilter !== "all", priorityFilter !== "all", createdByFilter !== null, folderId !== null, includeCompleted].filter(Boolean).length}
        clearPath="/tasks"
        clearKeys={["search", "date_from", "date_to", "status", "priority", "member", "folder", "include_completed", "sort", "order", "page"]}
      >
        <FilterPeriodPicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(v) => updateUrlFilter({ date_from: v.date_from, date_to: v.date_to })}
        />
        <FilterSelect value={statusFilter} onValueChange={(v) => updateUrlFilter({ status: v as StatusFilter })}>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="todo">À faire</SelectItem>
          <SelectItem value="in_progress">En cours</SelectItem>
          <SelectItem value="done">Terminé</SelectItem>
        </FilterSelect>
        <FilterSelect value={priorityFilter} onValueChange={(v) => updateUrlFilter({ priority: v as PriorityFilter })}>
          <SelectItem value="all">Toutes priorités</SelectItem>
          <SelectItem value="low">Basse</SelectItem>
          <SelectItem value="normal">Normale</SelectItem>
          <SelectItem value="high">Haute</SelectItem>
        </FilterSelect>
        <MemberFilterSelect
          members={members}
          value={createdByFilter}
          currentUserId={user?.id ?? null}
          selfLabel="Mes tâches"
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        {canViewFiles ? (
          <FilterFolderPicker
            folders={folders}
            selectedFolderId={folderId}
            buttonLabel={folderId == null ? "Tous les dossiers" : (folderNameById.get(folderId) ?? "Dossier")}
            description="Filtrer les tâches par dossier."
            onSelect={(id) => updateUrlFilter({ folder: id == null ? "all" : `folder-${id}` })}
            onCreateFolderAction={canEditTasks ? handleCreateFolder : undefined}
          />
        ) : null}
        <FilterToggle
          pressed={includeCompleted || statusFilter === "done"}
          onPressedChange={(pressed) => updateUrlFilter({ include_completed: pressed })}
        >
          Inclure terminées
        </FilterToggle>
      </CollapsibleFilterBar>

      {myTasks.length > 0 ? (
        <Card className="rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" />
              Mes taches assignees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTable
              tasks={myTasks}
              canEdit={canEditTasks}
              canDelete={canDeleteTasks}
              deletingId={deleteTask.isPending ? deleteTask.variables : null}
              defaultVisibility={{ assignees: false }}
              sortField={sortField}
              sortDir={sortDir}
              onSortChange={(field, dir) => updateUrlFilter({ sort: field, order: dir })}
              onOpenDetail={setViewingTask}
              onEdit={setEditingTask}
              onDelete={setDeletingTask}
              onStatusChange={handleStatusChange}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Taches</CardTitle>
        </CardHeader>
        <CardContent>
          <FormErrorAlert error={getErrorMessage(tasksQuery.error)} className="mb-3" />
          {tasksQuery.isLoading ? (
            <SkeletonLoader count={3} className="h-20 rounded-md" />
          ) : tasks.length === 0 ? (
            <EmptyResultsState
              className="border p-8"
              title="Aucune tache"
              description="Aucune tache ne correspond a cette vue."
            />
          ) : (
            <>
              <TaskTable
                tasks={tasks}
                canEdit={canEditTasks}
                canDelete={canDeleteTasks}
                deletingId={deleteTask.isPending ? deleteTask.variables : null}
                sortField={sortField}
                sortDir={sortDir}
                onSortChange={(field, dir) => updateUrlFilter({ sort: field, order: dir })}
                onOpenDetail={setViewingTask}
                onEdit={setEditingTask}
                onDelete={setDeletingTask}
                onStatusChange={handleStatusChange}
              />
              <PaginationBar
                count={totalCount}
                page={page}
                pageSize={getApiPageSize(tasksQuery.data)}
                onPageChange={(p) => updateUrlFilter({ page: p })}
              />
            </>
          )}
        </CardContent>
      </Card>

      <TaskFormDialog
        mode="create"
        open={createDialogOpen}
        projectId={projectId!}
        canViewFiles={canViewFiles}
        folders={folders}
        members={members}
        initialFolder={folderFilter}
        isPending={createTask.isPending}
        error={createTask.error}
        onOpenChange={setCreateDialogOpen}
        onCreateFolderAction={canEditTasks ? handleCreateFolder : undefined}
        onSubmit={(payload) => { if (selectedProject && canEditTasks) createTask.mutate(payload); }}
      />
      <TaskFormDialog
        key={editingTask?.id ?? "edit-none"}
        mode="edit"
        task={editingTask}
        projectId={projectId!}
        canViewFiles={canViewFiles}
        folders={folders}
        members={members}
        isPending={updateTask.isPending}
        error={updateTask.error}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreateFolderAction={canEditTasks ? handleCreateFolder : undefined}
        onSubmit={(payload) => editingTask && updateTask.mutate({ taskId: editingTask.id, payload })}
      />
      <TaskDetailModal
        task={viewingTask}
        projectId={projectId!}
        canEdit={canEditTasks}
        canDelete={canDeleteTasks}
        deletingId={deleteTask.isPending ? deleteTask.variables : null}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => { setViewingTask(null); setEditingTask(task); }}
        onDelete={(task) => { setViewingTask(null); setDeletingTask(task); }}
      />
      <DocumentPreviewDialog
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
      <ConfirmDeleteDialog
        open={deletingTask != null}
        title={`Supprimer "${deletingTask?.title}" ?`}
        isPending={deleteTask.isPending}
        onConfirm={() => deletingTask && deleteTask.mutate(deletingTask.id)}
        onClose={() => setDeletingTask(null)}
      />
    </div>
  );
}
