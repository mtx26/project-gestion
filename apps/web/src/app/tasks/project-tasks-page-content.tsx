"use client";

import type { Task, TaskPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Lock, UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/ui/filter-bar";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { TaskDetailModal } from "@/components/ui/task-detail-modal";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";
import { parseBooleanParam, parseIdParam, setOptionalParam } from "@/lib/url-params";
import { TaskFormDialog } from "./components/task-form-dialog";
import { TaskTable } from "./components/task-table";
import {
  type FolderFilter,
  type PriorityFilter,
  type StatusFilter,
  buildTasksHref,
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
      onProjectSelected={(id) => router.push(buildTasksHref(id, searchParams))}
      onProjectCreated={(project) => router.push(buildTasksHref(project.id, searchParams))}
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
  queryClient,
}: ProjectWorkspaceState) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canViewTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskView);
  const canEditTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskEdit);
  const canDeleteTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskDelete);
  const canViewFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileView);
  const folderFilter = parseFolderFilter(searchParams.get("folder"));
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const priorityFilter = parsePriorityFilter(searchParams.get("priority"));
  const includeCompleted = parseBooleanParam(searchParams.get("include_completed"));
  const showCompleted = includeCompleted || statusFilter === "done";
  const createdByFilter = parseIdParam(searchParams.get("member"));
  const folderId = getFolderId(folderFilter);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newTaskFolder, setNewTaskFolder] = useState<FolderFilter>(folderFilter);
  const [newTaskPriority, setNewTaskPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<number[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get("new") === "1");

  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFolder, setEditFolder] = useState<FolderFilter>("all");
  const [editStatus, setEditStatus] = useState<Task["status"]>("todo");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("normal");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssignees, setEditAssignees] = useState<number[]>([]);

  const tasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, {
          folderId: folderId ?? undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          createdBy: createdByFilter ?? undefined,
        })
      : ["tasks", "disabled"],
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        ...(folderId == null ? {} : { folder: folderId }),
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
        ...(createdByFilter == null ? {} : { created_by: createdByFilter }),
      }),
    enabled: Boolean(selectedProject && canViewTasks),
  });
  const foldersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.folders.tree(selectedProject.id) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewFiles),
  });
  const membersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.members.list(selectedProject.id) : ["members", "disabled"],
    queryFn: () => api.members.list(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewTasks),
  });

  const folderNameById = useMemo(() => buildFolderNameMap(foldersQuery.data ?? []), [foldersQuery.data]);
  const tasks = normalizeApiList(tasksQuery.data);
  const members = normalizeApiList(membersQuery.data);
  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => t.status !== "done");
  const myTasks = user ? visibleTasks.filter((t) => t.assigned_to.includes(user.id)) : [];

  const createTask = useMutation({
    mutationFn: () =>
      api.tasks.create(selectedProject!.id, {
        title: title.trim(),
        description: description.trim() || null,
        folder: getFolderId(newTaskFolder),
        priority: newTaskPriority,
        status: "todo",
        due_date: dueDate || null,
        assigned_to: newTaskAssignees,
      }),
    onSuccess: async () => {
      toast.success("Tache creee");
      setTitle("");
      setDescription("");
      setNewTaskFolder(folderFilter);
      setNewTaskPriority("normal");
      setDueDate("");
      setNewTaskAssignees([]);
      setCreateDialogOpen(false);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      api.tasks.update(selectedProject!.id, taskId, payload),
    onSuccess: async () => {
      toast.success("Tache mise a jour");
      setEditingTask(null);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: number) => api.tasks.remove(selectedProject!.id, taskId),
    onSuccess: async () => {
      toast.success("Tache supprimee");
      await invalidateTasks(queryClient, selectedProject!.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(selectedProject!.id, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(selectedProject!.id) });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function handleCreateFolder(name: string, parentId: number | null): Promise<void> {
    await createFolder.mutateAsync({ name, parentId });
  }

  function updateUrlFilter(
    changes: Partial<{ folder: FolderFilter; status: StatusFilter; priority: PriorityFilter; includeCompleted: boolean; member: number | null }>,
  ) {
    if (!selectedProject) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if (changes.folder !== undefined) setOptionalParam(params, "folder", changes.folder);
    if (changes.status !== undefined) setOptionalParam(params, "status", changes.status);
    if (changes.priority !== undefined) setOptionalParam(params, "priority", changes.priority);
    if (changes.includeCompleted !== undefined) {
      if (changes.includeCompleted) params.set("include_completed", "1");
      else params.delete("include_completed");
    }
    if ("member" in changes) {
      if (changes.member != null) params.set("member", String(changes.member));
      else params.delete("member");
    }
    router.replace(`/tasks?${params.toString()}`, { scroll: false });
  }

  function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !canEditTasks || !title.trim()) return;
    createTask.mutate();
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditFolder(task.folder == null ? "all" : `folder-${task.folder}`);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ?? "");
    setEditAssignees(task.assigned_to ?? []);
  }

  function submitEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    updateTask.mutate({
      taskId: editingTask.id,
      payload: {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        folder: getFolderId(editFolder),
        status: editStatus,
        priority: editPriority,
        due_date: editDueDate || null,
        assigned_to: editAssignees,
      },
    });
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
    return (
      <div className="space-y-5">
        <PageTitle category="Taches" title="Gestion du travail" />
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Taches indisponibles</AlertTitle>
          <AlertDescription>Ton role ne permet pas de voir les taches de ce projet.</AlertDescription>
        </Alert>
      </div>
    );
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
            folders={foldersQuery.data ?? []}
            selectedFolderId={folderId}
            buttonLabel={folderId == null ? "Tous les dossiers" : (folderNameById.get(folderId) ?? "Dossier")}
            description="Filtrer les tâches par dossier."
            onSelect={(id) => updateUrlFilter({ folder: id == null ? "all" : `folder-${id}` })}
            onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
          />
        ) : null}
        <FilterToggle
          pressed={showCompleted}
          onPressedChange={(pressed) => updateUrlFilter({ includeCompleted: pressed })}
        >
          Inclure terminées
        </FilterToggle>
        <FilterClear path="/tasks" removeKeys={["folder", "status", "priority", "member", "include_completed"]} />
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
              folderNameById={folderNameById}
              members={members}
              canEdit={canEditTasks}
              canDelete={canDeleteTasks}
              deletingId={deleteTask.isPending ? deleteTask.variables : null}
              defaultVisibility={{ assignees: false }}
              onOpenDetail={setViewingTask}
              onEdit={openEditTask}
              onDelete={(task) => deleteTask.mutate(task.id)}
              onStatusChange={(task, status) => updateTask.mutate({ taskId: task.id, payload: { status } })}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Taches</CardTitle>
        </CardHeader>
        <CardContent>
          <FormErrorAlert error={tasksQuery.error ? getErrorMessage(tasksQuery.error) : null} className="mb-3" />
          {tasksQuery.isLoading ? (
            <SkeletonLoader count={3} className="h-20 rounded-md" />
          ) : visibleTasks.length === 0 ? (
            <Empty className="border p-8">
              <EmptyHeader>
                <EmptyTitle>Aucune tache</EmptyTitle>
                <EmptyDescription>Aucune tache ne correspond a cette vue.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <TaskTable
              tasks={visibleTasks}
              folderNameById={folderNameById}
              members={members}
              canEdit={canEditTasks}
              canDelete={canDeleteTasks}
              deletingId={deleteTask.isPending ? deleteTask.variables : null}
              onOpenDetail={setViewingTask}
              onEdit={openEditTask}
              onDelete={(task) => deleteTask.mutate(task.id)}
              onStatusChange={(task, status) => updateTask.mutate({ taskId: task.id, payload: { status } })}
            />
          )}
        </CardContent>
      </Card>

      <TaskFormDialog
        mode="create"
        open={createDialogOpen}
        canViewFiles={canViewFiles}
        folders={foldersQuery.data ?? []}
        members={members}
        assignees={newTaskAssignees}
        title={title}
        description={description}
        folder={newTaskFolder}
        priority={newTaskPriority}
        dueDate={dueDate}
        isPending={createTask.isPending}
        error={createTask.error ? getErrorMessage(createTask.error) : null}
        onOpenChange={setCreateDialogOpen}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onFolderChange={setNewTaskFolder}
        onPriorityChange={setNewTaskPriority}
        onDueDateChange={setDueDate}
        onAssigneesChange={setNewTaskAssignees}
        onSubmit={onCreateTask}
        onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
      />
      <TaskFormDialog
        mode="edit"
        task={editingTask}
        canViewFiles={canViewFiles}
        folders={foldersQuery.data ?? []}
        members={members}
        assignees={editAssignees}
        title={editTitle}
        description={editDescription}
        folder={editFolder}
        status={editStatus}
        priority={editPriority}
        dueDate={editDueDate}
        isPending={updateTask.isPending}
        error={updateTask.error ? getErrorMessage(updateTask.error) : null}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onFolderChange={setEditFolder}
        onStatusChange={setEditStatus}
        onPriorityChange={setEditPriority}
        onDueDateChange={setEditDueDate}
        onAssigneesChange={setEditAssignees}
        onSubmit={submitEditTask}
        onCreateFolder={canEditTasks ? handleCreateFolder : undefined}
      />
      <TaskDetailModal
        task={viewingTask}
        folderNameById={folderNameById}
        members={members}
        canEdit={canEditTasks}
        canDelete={canDeleteTasks}
        deletingId={deleteTask.isPending ? deleteTask.variables : null}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => { setViewingTask(null); openEditTask(task); }}
        onDelete={(task) => { setViewingTask(null); deleteTask.mutate(task.id); }}
      />
    </div>
  );
}
