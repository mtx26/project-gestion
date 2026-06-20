"use client";

import type { FolderTreeNode, Task, TaskPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Pencil, Plus, Trash2, UserCheck, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { type FormEvent } from "react";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { TaskPriorityBadge } from "@/components/ui/task-priority-badge";
import { TaskStatusBadge } from "@/components/ui/task-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
import { TreePickerDialog } from "@/components/ui/tree-picker";
import { TaskDetailModal } from "@/components/ui/task-detail-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSelect, FilterToggle } from "@/components/ui/filter-bar";
import { PageTitle } from "@/components/ui/page-title";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap, findFolderName } from "@/lib/folder-utils";
import { formatTaskDate, getStatusClassName } from "@/lib/task-utils";
import { parseBooleanParam, parseIdParam, setOptionalParam } from "@/lib/url-params";

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
  const includeCompleted = parseBooleanParam(searchParams.get("include_completed"));
  const showCompleted = includeCompleted || statusFilter === "done";

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

  const createdByFilter = parseIdParam(searchParams.get("member"));
  const folderId = getFolderId(folderFilter);

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

  function updateUrlFilter(changes: Partial<{ folder: FolderFilter; status: StatusFilter; priority: PriorityFilter; includeCompleted: boolean; member: number | null }>) {
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
        <PageTitle category="Taches" title="Gestion du travail" />
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
        <PageTitle category="Taches" title="Gestion du travail" />
        {canEditTasks ? (
          <Button type="button" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
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
              onStatusChange={(task, status) =>
                updateTask.mutate({ taskId: task.id, payload: { status } })
              }
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
            <div className="space-y-2">
              <Skeleton className="h-20 rounded-md" />
              <Skeleton className="h-20 rounded-md" />
            </div>
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
              onStatusChange={(task, status) =>
                updateTask.mutate({ taskId: task.id, payload: { status } })
              }
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

function TaskFormDialog({
  mode,
  open,
  task,
  canViewFiles,
  folders,
  members,
  assignees,
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
  onAssigneesChange,
  onCreateFolder,
  onSubmit,
}: {
  mode: "create" | "edit";
  open?: boolean;
  task?: Task | null;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  members: { id: number; user: number; user_display_name: string }[];
  assignees: number[];
  title: string;
  description: string;
  folder: FolderFilter;
  status?: Task["status"];
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (value: FolderFilter) => void;
  onStatusChange?: (value: Task["status"]) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onAssigneesChange: (ids: number[]) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isOpen = mode === "create" ? (open ?? false) : task != null;
  const folderId = getFolderId(folder);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle tache" : "Modifier la tache"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Ajoute une tache et rattache-la au bon dossier si necessaire."
              : "Modifie le titre, la cible, le statut et les informations de suivi."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field>
            <FieldLabel htmlFor="task-form-title">Titre</FieldLabel>
            <Input id="task-form-title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {canViewFiles ? (
              <Field>
                <FieldLabel>Dossier</FieldLabel>
                <TreePickerDialog
                  mode="folder"
                  folders={folders}
                  selectedFolderId={folderId}
                  buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                  description="Selectionne le dossier qui recevra la tache."
                  onSelect={(id) => onFolderChange(id == null ? "all" : `folder-${id}`)}
                  onCreateFolder={onCreateFolder}
                />
              </Field>
            ) : null}
            {mode === "edit" && status !== undefined && onStatusChange ? (
              <Field>
                <FieldLabel>Statut</FieldLabel>
                <Select value={status} onValueChange={(v) => onStatusChange(v as Task["status"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A faire</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="done">Termine</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : mode === "create" ? (
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Select value={priority} onValueChange={(v) => onPriorityChange(v as Task["priority"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {mode === "edit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Select value={priority} onValueChange={(v) => onPriorityChange(v as Task["priority"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Echeance</FieldLabel>
                <DatePicker value={dueDate} onChange={onDueDateChange} />
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel>Echeance</FieldLabel>
              <DatePicker value={dueDate} onChange={onDueDateChange} />
            </Field>
          )}

          {members.length > 0 ? (
            <Field>
              <FieldLabel>Assignes</FieldLabel>
              <MemberCombobox members={members} value={assignees} onChange={onAssigneesChange} />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="task-form-description">Description</FieldLabel>
            <Textarea id="task-form-description" rows={3} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
          </Field>

          <FormErrorAlert error={error} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {mode === "create" ? (isPending ? "Creation..." : "Creer") : (isPending ? "Enregistrement..." : "Enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberCombobox({
  members,
  value,
  onChange,
}: {
  members: { id: number; user: number; user_display_name: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? members.filter((m) => m.user_display_name.toLowerCase().includes(search.toLowerCase()))
    : members;

  function toggle(userId: number) {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
    setSearch("");
    inputRef.current?.focus();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverAnchor asChild>
        <div
          className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 cursor-text"
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        >
          {value.map((uid) => {
            const member = members.find((m) => m.user === uid);
            if (!member) return null;
            return (
              <span
                key={uid}
                className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                {member.user_display_name}
                <button
                  type="button"
                  aria-label={`Retirer ${member.user_display_name}`}
                  className="opacity-50 hover:opacity-100 focus:outline-none"
                  onClick={(e) => { e.stopPropagation(); toggle(uid); }}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !search && value.length > 0) onChange(value.slice(0, -1));
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={value.length === 0 ? "Assigner des membres..." : ""}
            className="min-w-16 flex-1 bg-transparent outline-none"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] gap-0 p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Aucun membre trouve.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.user}
              type="button"
              className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pl-1.5 pr-8 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(m.user)}
            >
              <span className="flex-1 text-left">{m.user_display_name}</span>
              {value.includes(m.user) ? <Check className="absolute right-2 size-4" /> : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

type TaskMember = { id: number; user: number; user_display_name: string };

function TaskTable({
  tasks,
  folderNameById,
  members,
  canEdit,
  canDelete,
  deletingId,
  defaultVisibility = {},
  onOpenDetail,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: Task[];
  folderNameById: Map<number, string>;
  members: TaskMember[];
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  defaultVisibility?: VisibilityState;
  onOpenDetail: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
}) {
  "use no memo";
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultVisibility);

  const userDisplayMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of members) map.set(m.user, m.user_display_name);
    return map;
  }, [members]);

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortButton column={column}>Tache</SortButton>,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: "folder",
        accessorFn: (row) => row.folder == null ? "" : (folderNameById.get(row.folder) ?? ""),
        header: ({ column }) => <SortButton column={column}>Dossier</SortButton>,
        cell: ({ row }) => {
          const name = row.original.folder == null ? "Projet" : (folderNameById.get(row.original.folder) ?? `Dossier #${row.original.folder}`);
          return <span className="text-muted-foreground">{name}</span>;
        },
        sortingFn: "alphanumeric",
      },
      {
        id: "status",
        accessorFn: (row) => ({ todo: 0, in_progress: 1, done: 2 }[row.status]),
        header: ({ column }) => <SortButton column={column}>Statut</SortButton>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <Select
                value={row.original.status}
                onValueChange={(v) => onStatusChange(row.original, v as Task["status"])}
              >
                <SelectTrigger className={`h-7 w-32 border px-2 text-xs font-medium ${getStatusClassName(row.original.status)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Termine</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <TaskStatusBadge status={row.original.status} />
            )}
          </div>
        ),
      },
      {
        id: "priority",
        accessorFn: (row) => ({ low: 0, normal: 1, high: 2 }[row.priority]),
        header: ({ column }) => <SortButton column={column}>Priorite</SortButton>,
        cell: ({ row }) => (
          <TaskPriorityBadge priority={row.original.priority} />
        ),
      },
      {
        id: "due_date",
        accessorKey: "due_date",
        header: ({ column }) => <SortButton column={column}>Echeance</SortButton>,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.due_date ? formatTaskDate(row.original.due_date) : "-"}
          </span>
        ),
        sortUndefined: "last",
      },
      {
        id: "assignees",
        header: () => <span>Assignes</span>,
        cell: ({ row }) => {
          const names = row.original.assigned_to.map((uid) => userDisplayMap.get(uid) ?? `#${uid}`).join(", ");
          return <span className="max-w-30 truncate text-muted-foreground">{names || "-"}</span>;
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Modifier"
                    onClick={() => onEdit(row.original)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
            ) : null}
            {canDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer"
                    disabled={deletingId === row.original.id}
                    onClick={() => onDelete(row.original)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ),
        enableSorting: false,
      },
    ],
    [folderNameById, userDisplayMap, canEdit, canDelete, deletingId, onEdit, onDelete, onStatusChange],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const columnLabels: Record<string, string> = {
    title: "Tache",
    folder: "Dossier",
    status: "Statut",
    priority: "Priorite",
    due_date: "Echeance",
    assignees: "Assignes",
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Columns3 className="size-4" />
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Afficher / masquer</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {columnLabels[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={header.id === "actions" ? "w-20 text-right" : header.id === "assignees" ? "hidden sm:table-cell" : undefined}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpenDetail(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.id === "actions" ? "text-right" : cell.column.id === "assignees" ? "hidden sm:table-cell" : undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortButton({
  column,
  children,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void; getCanSort: () => boolean };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  if (!column.getCanSort()) return <span>{children}</span>;
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? (
        <ChevronUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </button>
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
  if (value === "todo" || value === "in_progress" || value === "done") return value;
  return "all";
}

function parsePriorityFilter(value: string | null): PriorityFilter {
  if (value === "low" || value === "normal" || value === "high") return value;
  return "all";
}

function getFolderId(value: FolderFilter) {
  if (value.startsWith("folder-")) return Number(value.replace("folder-", ""));
  return null;
}

async function invalidateTasks(queryClient: ProjectWorkspaceState["queryClient"], projectId: number) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
}
