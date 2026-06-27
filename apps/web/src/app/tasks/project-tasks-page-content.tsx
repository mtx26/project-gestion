"use client";

import type { Task, TaskPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/filters/filter-bar";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";
import { buildProjectHref, parseBooleanParam, parseIdParam, parsePageParam } from "@/lib/url-params";
import { PaginationBar } from "@/components/pagination-bar";
import { useProjectResources } from "@/lib/use-project-resources";
import { useUrlFilter } from "@/lib/use-url-filter";
import { TaskFormDialog } from "./components/task-form-dialog";
import { TaskTable } from "./components/task-table";
import {
  type PriorityFilter,
  type StatusFilter,
  getFolderId,
  invalidateTasks,
  parseFolderFilter,
  parsePriorityFilter,
  parseStatusFilter,
} from "./lib/filters";

export function ProjectTasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="tasks"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/tasks", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/tasks", project.id, searchParams))}
    >
      {(state) => <ProjectTasksContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectTasksContent({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
}: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const canViewTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskView);
  const canEditTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskEdit);
  const canDeleteTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskDelete);
  const canViewFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileView);
  const projectId = selectedProject?.id ?? null;
  const folderFilter = parseFolderFilter(searchParams.get("folder"));
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const priorityFilter = parsePriorityFilter(searchParams.get("priority"));
  const includeCompleted = parseBooleanParam(searchParams.get("include_completed"));
  const excludeDone = !includeCompleted && statusFilter === "all";
  const createdByFilter = parseIdParam(searchParams.get("member"));
  const folderId = getFolderId(folderFilter);
  const page = parsePageParam(searchParams.get("page"));
  const sortField = searchParams.get("sort") ?? "";
  const sortDir = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";
  const ordering = sortField ? `${sortDir === "desc" ? "-" : ""}${sortField}` : undefined;

  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get("new") === "1");
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const updateUrlFilter = useUrlFilter("/tasks", searchParams, projectId);
  const { folders, members, folderNameById, handleCreateFolder } = useProjectResources(
    projectId,
    { canView: canViewFiles, canEdit: false, canFetchMembers: canViewTasks },
  );

  const tasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, {
          folderId: folderId ?? undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          createdBy: createdByFilter ?? undefined,
          excludeDone: excludeDone || undefined,
          page,
          ordering,
        })
      : ["tasks", "disabled"],
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        ...(folderId == null ? {} : { folder: folderId }),
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
        ...(createdByFilter == null ? {} : { created_by: createdByFilter }),
        exclude_done: excludeDone || undefined,
        page,
        ordering,
      }),
    enabled: Boolean(selectedProject && canViewTasks),
    placeholderData: keepPreviousData,
  });

  const myTasksQuery = useQuery({
    queryKey: selectedProject && user
      ? queryKeys.tasks.list(selectedProject.id, {
          folderId: folderId ?? undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          excludeDone: excludeDone || undefined,
          assignedTo: user.id,
        })
      : ["tasks", "my-tasks", "disabled"],
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        ...(folderId == null ? {} : { folder: folderId }),
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
        exclude_done: excludeDone || undefined,
        assigned_to: user!.id,
      }),
    enabled: Boolean(selectedProject && canViewTasks && user),
    placeholderData: keepPreviousData,
  });

  const tasks = normalizeApiList(tasksQuery.data);
  const totalCount = getApiCount(tasksQuery.data);
  const myTasks = normalizeApiList(myTasksQuery.data);

  const createTask = useMutation({
    mutationFn: (payload: TaskPayload) => api.tasks.create(selectedProject!.id, payload),
    onSuccess: async () => {
      toast.success("Tache creee");
      setCreateDialogOpen(false);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
    onError: toastError,
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      api.tasks.update(selectedProject!.id, taskId, payload),
    onSuccess: async () => {
      toast.success("Tache mise a jour");
      setEditingTask(null);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
    onError: toastError,
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: number) => api.tasks.remove(selectedProject!.id, taskId),
    onSuccess: async () => {
      toast.success("Tache supprimee");
      await invalidateTasks(queryClient, selectedProject!.id);
    },
    onError: toastError,
  });

  function handleStatusChange(task: Task, status: Task["status"]) {
    const payload: Partial<TaskPayload> = { status };
    if (status === "in_progress" && !task.start_date) {
      payload.start_date = new Date().toISOString().split("T")[0];
    }
    updateTask.mutate({ taskId: task.id, payload });
  }

  if (projectsQuery.isLoading) return <Skeleton className="h-72 rounded-lg" />;

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={Check}
        description="Cree ou selectionne un projet pour gerer les taches."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewTasks) {
    return <AccessDeniedState description="Ton role ne permet pas de voir les taches de ce projet." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Taches" title="Gestion du travail" />
        {canEditTasks ? (
          <Button type="button" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            Nouvelle tache
          </Button>
        ) : null}
      </div>

      <FilterBar>
        <FilterSelect value={statusFilter} onValueChange={(value) => updateUrlFilter({ status: value as StatusFilter })}>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="todo">À faire</SelectItem>
          <SelectItem value="in_progress">En cours</SelectItem>
          <SelectItem value="done">Terminé</SelectItem>
        </FilterSelect>
        <FilterSelect value={priorityFilter} onValueChange={(value) => updateUrlFilter({ priority: value as PriorityFilter })}>
          <SelectItem value="all">Toutes priorités</SelectItem>
          <SelectItem value="low">Basse</SelectItem>
          <SelectItem value="normal">Normale</SelectItem>
          <SelectItem value="high">Haute</SelectItem>
        </FilterSelect>
        <MemberFilterSelect
          members={members}
          value={createdByFilter}
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
            onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
          />
        ) : null}
        <FilterToggle
          pressed={includeCompleted || statusFilter === "done"}
          onPressedChange={(pressed) => updateUrlFilter({ include_completed: pressed })}
        >
          Inclure terminées
        </FilterToggle>
        <FilterClear path="/tasks" removeKeys={["folder", "status", "priority", "member", "include_completed", "page", "sort", "order"]} />
      </FilterBar>

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
              onDelete={(task) => deleteTask.mutate(task.id)}
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
            <Empty className="border p-8">
              <EmptyHeader>
                <EmptyTitle>Aucune tache</EmptyTitle>
                <EmptyDescription>Aucune tache ne correspond a cette vue.</EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                onDelete={(task) => deleteTask.mutate(task.id)}
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
        canViewFiles={canViewFiles}
        folders={folders}
        members={members}
        initialFolder={folderFilter}
        isPending={createTask.isPending}
        error={getErrorMessage(createTask.error)}
        onOpenChange={setCreateDialogOpen}
        onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
        onSubmit={(payload) => { if (selectedProject && canEditTasks) createTask.mutate(payload); }}
      />
      <TaskFormDialog
        key={editingTask?.id ?? "edit-none"}
        mode="edit"
        task={editingTask}
        canViewFiles={canViewFiles}
        folders={folders}
        members={members}
        isPending={updateTask.isPending}
        error={getErrorMessage(updateTask.error)}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
        onSubmit={(payload) => editingTask && updateTask.mutate({ taskId: editingTask.id, payload })}
      />
      <TaskDetailModal
        task={viewingTask}
        canEdit={canEditTasks}
        canDelete={canDeleteTasks}
        deletingId={deleteTask.isPending ? deleteTask.variables : null}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => { setViewingTask(null); setEditingTask(task); }}
        onDelete={(task) => { setViewingTask(null); deleteTask.mutate(task.id); }}
      />
    </div>
  );
}
