"use client";

import type { FolderTreeNode, Task, TaskPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { type FormEvent } from "react";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderTreePickerDialog } from "@/components/ui/folder-tree-picker";
import { TaskDetailModal } from "@/components/ui/task-detail-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatTaskDate, getPriorityClassName, getPriorityLabel, getStatusClassName, getStatusLabel } from "@/lib/task-utils";

type StatusFilter = "all" | Task["status"];
type PriorityFilter = "all" | Task["priority"];
type FolderFilter = "all" | `folder-${number}`;
type SortColumn = "title" | "folder" | "status" | "priority" | "due_date";
type SortDirection = "asc" | "desc";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newTaskFolder, setNewTaskFolder] = useState<FolderFilter>(folderFilter);
  const [newTaskPriority, setNewTaskPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get("new") === "1");
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFolder, setEditFolder] = useState<FolderFilter>("all");
  const [editStatus, setEditStatus] = useState<Task["status"]>("todo");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("normal");
  const [editDueDate, setEditDueDate] = useState("");

  const folderId = getFolderId(folderFilter);
  const tasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, {
          folderId: folderId ?? undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
        })
      : ["tasks", "disabled"],
    queryFn: () =>
      api.tasks.list(selectedProject!.id, {
        ...(folderId == null ? {} : { folder: folderId }),
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
        ...(priorityFilter === "all" ? {} : { priority: priorityFilter }),
      }),
    enabled: Boolean(selectedProject && canViewTasks),
  });
  const foldersQuery = useQuery({
    queryKey: selectedProject ? queryKeys.folders.tree(selectedProject.id) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewFiles),
  });
  const folderNameById = useMemo(() => buildFolderNameMap(foldersQuery.data ?? []), [foldersQuery.data]);
  const tasks = normalizeApiList(tasksQuery.data);
  const sortedTasks = useMemo(() => {
    if (!sortConfig) {
      return tasks;
    }

    const STATUS_ORDER: Record<Task["status"], number> = { todo: 0, in_progress: 1, done: 2 };
    const PRIORITY_ORDER: Record<Task["priority"], number> = { low: 0, normal: 1, high: 2 };
    const multiplier = sortConfig.direction === "asc" ? 1 : -1;

    return [...tasks].sort((a, b) => {
      switch (sortConfig.column) {
        case "title":
          return multiplier * a.title.localeCompare(b.title, "fr");
        case "folder": {
          const aName = a.folder == null ? "" : (folderNameById.get(a.folder) ?? "");
          const bName = b.folder == null ? "" : (folderNameById.get(b.folder) ?? "");
          return multiplier * aName.localeCompare(bName, "fr");
        }
        case "status":
          return multiplier * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        case "priority":
          return multiplier * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        case "due_date": {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return multiplier * a.due_date.localeCompare(b.due_date);
        }
        default:
          return 0;
      }
    });
  }, [tasks, sortConfig, folderNameById]);

  const createTask = useMutation({
    mutationFn: () =>
      api.tasks.create(selectedProject!.id, {
        title: title.trim(),
        description: description.trim() || null,
        folder: getFolderId(newTaskFolder),
        priority: newTaskPriority,
        status: "todo",
        due_date: dueDate || null,
      }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setNewTaskFolder(folderFilter);
      setNewTaskPriority("normal");
      setDueDate("");
      setCreateDialogOpen(false);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      api.tasks.update(selectedProject!.id, taskId, payload),
    onSuccess: async () => {
      setEditingTask(null);
      await invalidateTasks(queryClient, selectedProject!.id);
    },
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: number) => api.tasks.remove(selectedProject!.id, taskId),
    onSuccess: async () => {
      await invalidateTasks(queryClient, selectedProject!.id);
    },
  });

  function updateUrlFilter(changes: Partial<{ folder: FolderFilter; status: StatusFilter; priority: PriorityFilter }>) {
    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if (changes.folder) {
      setOptionalParam(params, "folder", changes.folder);
    }
    if (changes.status) {
      setOptionalParam(params, "status", changes.status);
    }
    if (changes.priority) {
      setOptionalParam(params, "priority", changes.priority);
    }

    router.replace(`/tasks?${params.toString()}`, { scroll: false });
  }

  function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !canEditTasks || !title.trim()) {
      return;
    }
    createTask.mutate();
  }

  function toggleSort(column: SortColumn) {
    setSortConfig((current) => {
      if (current?.column === column) {
        return { column, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditFolder(task.folder == null ? "all" : `folder-${task.folder}`);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ?? "");
  }

  function submitEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask || !editTitle.trim()) {
      return;
    }

    updateTask.mutate({
      taskId: editingTask.id,
      payload: {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        folder: getFolderId(editFolder),
        status: editStatus,
        priority: editPriority,
        due_date: editDueDate || null,
      },
    });
  }

  if (projectsQuery.isLoading) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (!selectedProject) {
    return (
      <Empty className="border bg-card p-8">
        <EmptyHeader>
          <EmptyTitle>Aucun projet actif</EmptyTitle>
          <EmptyDescription>Cree ou selectionne un projet pour gerer les taches.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openCreateProject}>Creer un projet</Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!canViewTasks) {
    return (
      <div className="space-y-5">
        <TasksTitle />
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <p className="font-medium">Taches indisponibles</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ton role ne permet pas de voir les taches de ce projet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <TasksTitle />
        {canEditTasks ? (
          <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            Nouvelle tache
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        {canViewFiles ? (
          <div className="w-full sm:w-56">
            <FolderTreePickerDialog
              folders={foldersQuery.data ?? []}
              selectedFolderId={folderId}
              buttonLabel={folderId == null ? "Tous les dossiers" : (folderNameById.get(folderId) ?? "Dossier")}
              description="Filtrer les taches par dossier."
              onSelect={(id) => updateUrlFilter({ folder: id == null ? "all" : `folder-${id}` })}
            />
          </div>
        ) : null}
        <Select value={statusFilter} onValueChange={(value) => updateUrlFilter({ status: value as StatusFilter })}>
          <SelectTrigger className="w-full bg-background sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="todo">A faire</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="done">Termine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(value) => updateUrlFilter({ priority: value as PriorityFilter })}>
          <SelectTrigger className="w-full bg-background sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorites</SelectItem>
            <SelectItem value="low">Basse</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Taches</CardTitle>
        </CardHeader>
        <CardContent>
          {tasksQuery.error ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{getErrorMessage(tasksQuery.error)}</AlertDescription>
            </Alert>
          ) : null}
          {tasksQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
            </div>
          ) : tasks.length === 0 ? (
            <Empty className="border p-8">
              <EmptyHeader>
                <EmptyTitle>Aucune tache</EmptyTitle>
                <EmptyDescription>Aucune tache ne correspond a cette vue.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <TaskTable
              tasks={sortedTasks}
              folderNameById={folderNameById}
              sortConfig={sortConfig}
              canEdit={canEditTasks}
              canDelete={canDeleteTasks}
              deletingId={deleteTask.isPending ? deleteTask.variables : null}
              onSort={toggleSort}
              onOpenDetail={setViewingTask}
              onEdit={openEditTask}
              onDelete={(task) => deleteTask.mutate(task.id)}
            />
          )}
          {updateTask.error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{getErrorMessage(updateTask.error)}</AlertDescription>
            </Alert>
          ) : null}
          {deleteTask.error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{getErrorMessage(deleteTask.error)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <TaskCreateDialog
        open={createDialogOpen}
        canViewFiles={canViewFiles}
        folders={foldersQuery.data ?? []}
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
        onSubmit={onCreateTask}
      />
      <TaskEditDialog
        task={editingTask}
        canViewFiles={canViewFiles}
        folders={foldersQuery.data ?? []}
        title={editTitle}
        description={editDescription}
        folder={editFolder}
        status={editStatus}
        priority={editPriority}
        dueDate={editDueDate}
        isPending={updateTask.isPending}
        error={updateTask.error ? getErrorMessage(updateTask.error) : null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
          }
        }}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onFolderChange={setEditFolder}
        onStatusChange={setEditStatus}
        onPriorityChange={setEditPriority}
        onDueDateChange={setEditDueDate}
        onSubmit={submitEditTask}
      />
      <TaskDetailModal
        task={viewingTask}
        folderNameById={folderNameById}
        canEdit={canEditTasks}
        canDelete={canDeleteTasks}
        deletingId={deleteTask.isPending ? deleteTask.variables : null}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => {
          setViewingTask(null);
          openEditTask(task);
        }}
        onDelete={(task) => {
          setViewingTask(null);
          deleteTask.mutate(task.id);
        }}
      />
    </div>
  );
}


function TasksTitle() {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">Taches</p>
      <h1 className="mt-1 text-2xl font-semibold">Gestion du travail</h1>
    </div>
  );
}

function TaskCreateDialog({
  open,
  canViewFiles,
  folders,
  title,
  description,
  folder,
  priority,
  dueDate,
  isPending,
  error,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onPriorityChange,
  onDueDateChange,
  onSubmit,
}: {
  open: boolean;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  title: string;
  description: string;
  folder: FolderFilter;
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (value: FolderFilter) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const folderId = getFolderId(folder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle tache</DialogTitle>
          <DialogDescription>Ajoute une tache et rattache-la au bon dossier si necessaire.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input id="task-title" value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {canViewFiles ? (
              <div className="space-y-2">
                <Label>Dossier</Label>
                <FolderTreePickerDialog
                  folders={folders}
                  selectedFolderId={folderId}
                  buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                  description="Selectionne le dossier qui recevra la tache."
                  onSelect={(id) => onFolderChange(id == null ? "all" : `folder-${id}`)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Priorite</Label>
              <Select value={priority} onValueChange={(value) => onPriorityChange(value as Task["priority"])}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-due-date">Echeance</Label>
            <Input id="task-due-date" type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskEditDialog({
  task,
  canViewFiles,
  folders,
  title,
  description,
  folder,
  status,
  priority,
  dueDate,
  isPending,
  error,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onSubmit,
}: {
  task: Task | null;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  title: string;
  description: string;
  folder: FolderFilter;
  status: Task["status"];
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (value: FolderFilter) => void;
  onStatusChange: (value: Task["status"]) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const folderId = getFolderId(folder);

  return (
    <Dialog open={task != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la tache</DialogTitle>
          <DialogDescription>Modifie le titre, la cible, le statut et les informations de suivi.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="edit-task-title">Titre</Label>
            <Input id="edit-task-title" value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {canViewFiles ? (
              <div className="space-y-2">
                <Label>Dossier</Label>
                <FolderTreePickerDialog
                  folders={folders}
                  selectedFolderId={folderId}
                  buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                  description="Selectionne le dossier qui recevra la tache."
                  onSelect={(id) => onFolderChange(id == null ? "all" : `folder-${id}`)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(value) => onStatusChange(value as Task["status"])}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Termine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priorite</Label>
              <Select value={priority} onValueChange={(value) => onPriorityChange(value as Task["priority"])}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-due-date">Echeance</Label>
              <Input id="edit-task-due-date" type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-description">Description</Label>
            <Textarea id="edit-task-description" rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SortableTableHead({
  column,
  sortConfig,
  onSort,
  children,
}: {
  column: SortColumn;
  sortConfig: { column: SortColumn; direction: SortDirection } | null;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
}) {
  const isActive = sortConfig?.column === column;
  const Icon = isActive
    ? sortConfig!.direction === "asc" ? ChevronUp : ChevronDown
    : ChevronsUpDown;

  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <Icon className={`size-3.5 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} />
      </div>
    </TableHead>
  );
}

function TaskTable({
  tasks,
  folderNameById,
  sortConfig,
  canEdit,
  canDelete,
  deletingId,
  onSort,
  onOpenDetail,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  folderNameById: Map<number, string>;
  sortConfig: { column: SortColumn; direction: SortDirection } | null;
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  onSort: (column: SortColumn) => void;
  onOpenDetail: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead column="title" sortConfig={sortConfig} onSort={onSort}>Tache</SortableTableHead>
          <SortableTableHead column="folder" sortConfig={sortConfig} onSort={onSort}>Dossier</SortableTableHead>
          <SortableTableHead column="status" sortConfig={sortConfig} onSort={onSort}>Statut</SortableTableHead>
          <SortableTableHead column="priority" sortConfig={sortConfig} onSort={onSort}>Priorite</SortableTableHead>
          <SortableTableHead column="due_date" sortConfig={sortConfig} onSort={onSort}>Echeance</SortableTableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const folderName = task.folder == null ? "Projet" : folderNameById.get(task.folder) ?? `Dossier #${task.folder}`;

          return (
            <TableRow key={task.id} className="cursor-pointer" onClick={() => onOpenDetail(task)}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell className="text-muted-foreground">{folderName}</TableCell>
              <TableCell>
                <Badge variant="outline" className={getStatusClassName(task.status)}>{getStatusLabel(task.status)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getPriorityClassName(task.priority)}>{getPriorityLabel(task.priority)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{task.due_date ? formatTaskDate(task.due_date) : "-"}</TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  {canEdit ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifier cette tache" onClick={() => onEdit(task)}>
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer cette tache" disabled={deletingId === task.id} onClick={() => onDelete(task)}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
function buildTasksHref(projectId: number, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("project", String(projectId));
  return `/tasks?${params.toString()}`;
}

function parseFolderFilter(value: string | null): FolderFilter {
  if (value?.startsWith("folder-") && Number(value.replace("folder-", "")) > 0) {
    return `folder-${Number(value.replace("folder-", ""))}`;
  }
  return "all";
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "todo" || value === "in_progress" || value === "done") {
    return value;
  }
  return "all";
}

function parsePriorityFilter(value: string | null): PriorityFilter {
  if (value === "low" || value === "normal" || value === "high") {
    return value;
  }
  return "all";
}

function getFolderId(value: FolderFilter) {
  if (value.startsWith("folder-")) {
    return Number(value.replace("folder-", ""));
  }
  return null;
}

function findFolderName(nodes: FolderTreeNode[], id: number): string | null {
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.id === id) return node.name;
      const found = findFolderName(node.children ?? [], id);
      if (found) return found;
    }
  }
  return null;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value === "all") {
    params.delete(key);
    return;
  }
  params.set(key, value);
}

function buildFolderNameMap(nodes: FolderTreeNode[], map = new Map<number, string>()): Map<number, string> {
  for (const node of nodes) {
    if (node.type === "folder") {
      map.set(node.id, node.name);
      buildFolderNameMap(node.children ?? [], map);
    }
  }
  return map;
}

async function invalidateTasks(queryClient: ProjectWorkspaceState["queryClient"], projectId: number) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
}

