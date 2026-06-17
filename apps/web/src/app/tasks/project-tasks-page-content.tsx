"use client";

import type { FolderTreeNode, Task, TaskPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, type FormEvent } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type StatusFilter = "all" | Task["status"];
type PriorityFilter = "all" | Task["priority"];
type FolderFilter = "all" | `folder-${number}`;

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
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(() => new Set());
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
  const folderOptions = useMemo(() => getFolderOptions(foldersQuery.data ?? []), [foldersQuery.data]);
  const folderNameById = useMemo(
    () => new Map(folderOptions.map((folder) => [folder.id, folder.name])),
    [folderOptions],
  );
  const tasks = normalizeApiList(tasksQuery.data);

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

  function toggleTaskExpanded(taskId: number) {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
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
          <Select value={folderFilter} onValueChange={(value) => updateUrlFilter({ folder: value as FolderFilter })}>
            <SelectTrigger className="w-full bg-background sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les dossiers</SelectItem>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.id} value={`folder-${folder.id}`}>
                  {"  ".repeat(folder.depth)}{folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              tasks={tasks}
              folderNameById={folderNameById}
              expandedTaskIds={expandedTaskIds}
              canEdit={canEditTasks}
              canDelete={canDeleteTasks}
              deletingId={deleteTask.isPending ? deleteTask.variables : null}
              onToggleExpanded={toggleTaskExpanded}
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
        folderOptions={folderOptions}
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
        folderOptions={folderOptions}
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
  folderOptions,
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
  folderOptions: Array<{ id: number; name: string; depth: number }>;
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
                <FolderPickerDialog
                  folderOptions={folderOptions}
                  selectedValue={folder}
                  onSelect={onFolderChange}
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
              <Button type="button" variant="outline">
                Annuler
              </Button>
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
  folderOptions,
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
  folderOptions: Array<{ id: number; name: string; depth: number }>;
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
                <FolderPickerDialog
                  folderOptions={folderOptions}
                  selectedValue={folder}
                  onSelect={onFolderChange}
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
              <Button type="button" variant="outline">
                Annuler
              </Button>
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

function FolderPickerDialog({
  folderOptions,
  selectedValue,
  onSelect,
}: {
  folderOptions: Array<{ id: number; name: string; depth: number }>;
  selectedValue: FolderFilter;
  onSelect: (value: FolderFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = selectedValue === "all"
    ? "Projet"
    : folderOptions.find((folder) => `folder-${folder.id}` === selectedValue)?.name ?? "Dossier";

  function selectFolder(value: FolderFilter) {
    onSelect(value);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Folder className="size-4 text-amber-500" />
        <span className="truncate">{selectedLabel}</span>
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choisir un dossier</DialogTitle>
          <DialogDescription>Parcours l&apos;arborescence et selectionne le dossier cible.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-background p-2">
          <button
            type="button"
            className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted ${selectedValue === "all" ? "bg-primary/10 text-primary" : ""}`}
            onClick={() => selectFolder("all")}
          >
            <Folder className="size-4 text-primary" />
            Projet
          </button>
          {folderOptions.map((folder) => {
            const value: FolderFilter = `folder-${folder.id}`;

            return (
              <button
                key={folder.id}
                type="button"
                className={`flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm hover:bg-muted ${selectedValue === value ? "bg-primary/10 text-primary" : ""}`}
                style={{ paddingLeft: `${folder.depth * 24 + 8}px` }}
                onClick={() => selectFolder(value)}
              >
                <Folder className="size-4 text-amber-500" />
                <span className="truncate">{folder.name}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskTable({
  tasks,
  folderNameById,
  expandedTaskIds,
  canEdit,
  canDelete,
  deletingId,
  onToggleExpanded,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  folderNameById: Map<number, string>;
  expandedTaskIds: Set<number>;
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  onToggleExpanded: (taskId: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Tache</TableHead>
          <TableHead>Dossier</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Priorite</TableHead>
          <TableHead>Echeance</TableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const expanded = expandedTaskIds.has(task.id);
          const folderName = task.folder == null ? "Projet" : folderNameById.get(task.folder) ?? `Dossier #${task.folder}`;

          return (
            <Fragment key={task.id}>
              <TableRow aria-expanded={expanded} className="cursor-pointer" onClick={() => onToggleExpanded(task.id)}>
                <TableCell>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                </TableCell>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell className="text-muted-foreground">{folderName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusClassName(task.status)}>{getStatusLabel(task.status)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getPriorityClassName(task.priority)}>{getPriorityLabel(task.priority)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{task.due_date ? formatDate(task.due_date) : "-"}</TableCell>
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
              {expanded ? (
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={6} className="bg-muted/20 whitespace-normal">
                    <div className="grid gap-3 py-2 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
                        <p className="mt-1 text-sm">{task.description || "Aucune description"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Creation</p>
                        <p className="mt-1 text-sm">{formatDate(task.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Fin</p>
                        <p className="mt-1 text-sm">{task.completed_at ? formatDate(task.completed_at) : "Pas terminee"}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
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

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value === "all") {
    params.delete(key);
    return;
  }
  params.set(key, value);
}

function getFolderOptions(nodes: FolderTreeNode[], depth = 0): Array<{ id: number; name: string; depth: number }> {
  const folders: Array<{ id: number; name: string; depth: number }> = [];

  for (const node of nodes) {
    if (node.type !== "folder") {
      continue;
    }

    folders.push({ id: node.id, name: node.name, depth });
    folders.push(...getFolderOptions(node.children ?? [], depth + 1));
  }

  return folders;
}

async function invalidateTasks(queryClient: ProjectWorkspaceState["queryClient"], projectId: number) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
}

function getStatusLabel(status: Task["status"]) {
  if (status === "in_progress") {
    return "En cours";
  }
  if (status === "done") {
    return "Termine";
  }
  return "A faire";
}

function getPriorityLabel(priority: Task["priority"]) {
  if (priority === "high") {
    return "Haute";
  }
  if (priority === "low") {
    return "Basse";
  }
  return "Normale";
}

function getStatusClassName(status: Task["status"]) {
  if (status === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "in_progress") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-muted bg-background text-muted-foreground";
}

function getPriorityClassName(priority: Task["priority"]) {
  if (priority === "high") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (priority === "low") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
  }).format(new Date(value));
}
