"use client";

import type { FolderTreeNode, Task, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Clock3,
  ChevronDown,
  ChevronRight,
  Download,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderTreePickerDialog } from "@/components/ui/folder-tree-picker";
import { TaskDetailModal } from "@/components/ui/task-detail-modal";
import { buildFolderNameMap, findFolderName, findFolderNode, getDescendantFolderIds } from "@/lib/folder-utils";
import { formatDuration, formatMoney, getStatusClassName, getStatusLabel } from "@/lib/task-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type FileActionTarget = {
  type: "folder" | "document";
  id: number;
  name: string;
};

type PreviewDocument = {
  url: string;
  file_name: string;
  mime_type: string | null;
};

const TREE_INDENT = 28;
const TREE_ROW_PADDING = 0;

export function ProjectFilesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="files"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      maxWidthClassName="max-w-6xl"
      onProjectSelected={(id) => router.push(`/files?project=${id}`)}
      onProjectCreated={(project) => router.push(`/files?project=${project.id}`)}
    >
      {(state) => <ProjectTreeView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectTreeView({ user, selectedProject, projectsQuery, openCreateProject, queryClient }: ProjectWorkspaceState) {
  const router = useRouter();
  const canViewFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileView);
  const canEditFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileEdit);
  const canDeleteFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileDelete);
  const canViewTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskView);
  const canEditTasks = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.taskEdit);
  const canViewTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryView);
  const canRecordTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryEdit);
  const selectedProjectId = selectedProject?.id ?? null;
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [selectedFolderState, setSelectedFolderState] = useState<{ projectId: number | null; id: number | null }>({
    projectId: null,
    id: null,
  });
  const [expandedFolderState, setExpandedFolderState] = useState<{
    projectId: number | null;
    ids: Set<number> | null;
  }>({
    projectId: null,
    ids: null,
  });
  const [contextTarget, setContextTarget] = useState<FileActionTarget | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FileActionTarget | null>(null);
  const [itemToRename, setItemToRename] = useState<FileActionTarget | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [taskDraftFolderId, setTaskDraftFolderId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("normal");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [timeDraftFolderId, setTimeDraftFolderId] = useState<number | null>(null);
  const [timeHours, setTimeHours] = useState("1");
  const [timeMinutes, setTimeMinutes] = useState("0");
  const [timeHourlyRate, setTimeHourlyRate] = useState(user?.profile?.default_hourly_rate ?? "0");
  const [timeDescription, setTimeDescription] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftFolder, setDraftFolder] = useState<{ parentFolder: number | null; name: string } | null>(null);
  const draftClosedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const treeQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.folders.tree(selectedProject.id, { includeTasks: true })
      : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(selectedProject!.id, { includeTasks: true }),
    enabled: Boolean(selectedProject && canViewFiles),
  });
  const createFolder = useMutation({
    mutationFn: ({ name, parentFolder }: { name: string; parentFolder: number | null }) =>
      api.folders.create(selectedProject!.id, {
        name,
        parent_folder: parentFolder,
      }),
    onSuccess: () => treeQuery.refetch(),
  });
  const uploadDocument = useMutation({
    mutationFn: ({ file, folder }: { file: File; folder: number | null }) =>
      api.documents.upload(selectedProject!.id, {
        file,
        folder,
      }),
    onSuccess: () => treeQuery.refetch(),
  });
  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(selectedProject!.id, documentId),
    onMutate: () => setActionError(null),
    onSuccess: (data) => {
      setPreviewDocument(data);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const deleteFolder = useMutation({
    mutationFn: (folderId: number) => api.folders.remove(selectedProject!.id, folderId),
    onMutate: () => setActionError(null),
    onSuccess: async (_data, folderId) => {
      setItemToDelete(null);
      setSelectedFolderState((current) =>
        current.projectId === selectedProjectId && current.id === folderId
          ? { projectId: selectedProjectId, id: null }
          : current,
      );
      await treeQuery.refetch();
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const deleteDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.remove(selectedProject!.id, documentId),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setItemToDelete(null);
      await treeQuery.refetch();
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const renameItem = useMutation<unknown, Error, { target: FileActionTarget; name: string }>({
    mutationFn: ({ target, name }: { target: FileActionTarget; name: string }) => {
      if (target.type === "folder") {
        return api.folders.update(selectedProject!.id, target.id, { name });
      }

      return api.documents.update(selectedProject!.id, target.id, { name });
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setItemToRename(null);
      setRenameValue("");
      await treeQuery.refetch();
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const moveFolder = useMutation({
    mutationFn: ({ folderId, newParentId }: { folderId: number; newParentId: number | null }) =>
      api.folders.update(selectedProject!.id, folderId, { parent_folder: newParentId }),
    onMutate: () => setActionError(null),
    onSuccess: async () => treeQuery.refetch(),
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const createTask = useMutation({
    mutationFn: () =>
      api.tasks.create(selectedProject!.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        folder: taskDraftFolderId,
        priority: taskPriority,
        status: "todo",
        due_date: taskDueDate || null,
      }),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setTaskDraftFolderId(null);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("normal");
      setTaskDueDate("");
      await Promise.all([
        treeQuery.refetch(),
        selectedProjectId ? queryClient.invalidateQueries({ queryKey: ["projects", selectedProjectId, "tasks"] }) : Promise.resolve(),
      ]);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const createTimeEntry = useMutation({
    mutationFn: () =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        folder: timeDraftFolderId,
        duration_minutes: Number(timeHours) * 60 + Number(timeMinutes),
        hourly_rate: timeHourlyRate === "" ? undefined : timeHourlyRate,
        description: timeDescription.trim() || null,
      }),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setTimeDraftFolderId(null);
      setTimeHours("1");
      setTimeMinutes("0");
      setTimeHourlyRate(user?.profile?.default_hourly_rate ?? "0");
      setTimeDescription("");
      if (selectedProjectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects", selectedProjectId, "time-entries"] });
      }
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const selectedFolderId = selectedFolderState.projectId === selectedProjectId ? selectedFolderState.id : null;

  const previewTasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, {})
      : ["tasks", "folder-preview", "disabled"],
    queryFn: () => api.tasks.list(selectedProject!.id, {}),
    enabled: Boolean(selectedProject && canViewTasks),
  });
  const previewTimeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? ["projects", selectedProject.id, "time-entries", "folder-preview"]
      : ["time-entries", "folder-preview", "disabled"],
    queryFn: () => api.timeEntries.list(selectedProject!.id),
    enabled: Boolean(selectedProject && canViewTime),
  });

  const descendantFolderIds = useMemo(
    () => getDescendantFolderIds(treeQuery.data ?? [], selectedFolderId),
    [treeQuery.data, selectedFolderId],
  );

  const folderNameById = useMemo(() => buildFolderNameMap(treeQuery.data ?? []), [treeQuery.data]);

  const rootExpandedFolderIds = useMemo(() => {
    return new Set((treeQuery.data ?? []).filter((node) => node.type === "folder").map((node) => node.id));
  }, [treeQuery.data]);
  const expandedFolderIds = expandedFolderState.projectId === selectedProjectId && expandedFolderState.ids
    ? expandedFolderState.ids
    : rootExpandedFolderIds;

  function setSelectedFolderId(folderId: number | null) {
    setSelectedFolderState({ projectId: selectedProjectId, id: folderId });
  }

  function toggleFolderExpanded(folderId: number) {
    setExpandedFolderState((current) => {
      const currentIds = current.projectId === selectedProjectId && current.ids ? current.ids : rootExpandedFolderIds;
      const next = new Set(currentIds);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return { projectId: selectedProjectId, ids: next };
    });
  }

  function onCreateSection(parentFolder: number | null) {
    draftClosedRef.current = false;
    if (parentFolder != null) {
      setExpandedFolderState((current) => {
        const currentIds = current.projectId === selectedProjectId && current.ids ? current.ids : rootExpandedFolderIds;
        return { projectId: selectedProjectId, ids: new Set([...currentIds, parentFolder]) };
      });
    }
    setDraftFolder({ parentFolder, name: "" });
  }

  function onCommitDraftFolder() {
    if (draftClosedRef.current) {
      return;
    }

    const name = draftFolder?.name.trim();
    if (!draftFolder || !name) {
      draftClosedRef.current = true;
      setDraftFolder(null);
      return;
    }

    draftClosedRef.current = true;
    createFolder.mutate({ name, parentFolder: draftFolder.parentFolder });
    setDraftFolder(null);
  }

  function onCancelDraftFolder() {
    draftClosedRef.current = true;
    setDraftFolder(null);
  }

  function onPickFile(folder: number | null) {
    setTargetFolderId(folder);
    fileInputRef.current?.click();
  }

  function onUploadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    uploadDocument.mutate({ file, folder: targetFolderId });
  }

  function requestRename(target: FileActionTarget) {
    setItemToRename(target);
    setRenameValue(target.name);
  }

  function requestDelete(target: FileActionTarget) {
    setItemToDelete(target);
  }

  function openTaskDraft(folderId: number | null) {
    setTaskDraftFolderId(folderId);
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("normal");
    setTaskDueDate("");
  }

  function openTimeDraft(folderId: number | null) {
    setTimeDraftFolderId(folderId);
    setTimeHours("1");
    setTimeMinutes("0");
    setTimeHourlyRate(user?.profile?.default_hourly_rate ?? "0");
    setTimeDescription("");
  }

  function submitTaskDraft() {
    if (!canEditTasks || !taskTitle.trim()) {
      return;
    }

    createTask.mutate();
  }

  function submitTimeDraft() {
    const durationMinutes = Number(timeHours) * 60 + Number(timeMinutes);
    if (!user || !canRecordTime || durationMinutes <= 0) {
      return;
    }

    createTimeEntry.mutate();
  }

  function handleMoveFolder(folderId: number, newParentId: number | null) {
    const tree = treeQuery.data ?? [];
    if (newParentId !== null && isFolderDescendantOf(tree, folderId, newParentId)) {
      setActionError("Impossible de deplacer un dossier dans l'un de ses sous-dossiers.");
      return;
    }
    moveFolder.mutate({ folderId, newParentId });
  }

  function buildFolderTimeHref(folderId: number) {
    const params = new URLSearchParams({
      project: String(selectedProjectId),
      target: `folder-${folderId}`,
    });
    return `/time?${params.toString()}`;
  }

  function buildFolderTasksHref(folderId: number) {
    return `/tasks?project=${selectedProjectId}&folder=folder-${folderId}`;
  }

  function confirmDelete() {
    if (!itemToDelete) {
      return;
    }

    if (itemToDelete.type === "folder") {
      deleteFolder.mutate(itemToDelete.id);
      return;
    }

    deleteDocument.mutate(itemToDelete.id);
  }

  function submitRename() {
    const name = renameValue.trim();
    if (!itemToRename || !name) {
      return;
    }

    renameItem.mutate({ target: itemToRename, name });
  }

  if (projectsQuery.isLoading) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (!selectedProject) {
    return (
      <Empty className="border bg-card p-8">
        <EmptyHeader>
          <EmptyTitle>Aucun projet actif</EmptyTitle>
          <EmptyDescription>Cree ou selectionne un projet pour voir son arborescence.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={openCreateProject}>Creer un projet</Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!canViewFiles) {
    return (
      <div className="space-y-5">
        <ProjectFilesTitle />
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <p className="font-medium">Fichiers indisponibles</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ton role ne permet pas de voir l&apos;arborescence de ce projet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedFolderName = findFolderName(treeQuery.data ?? [], selectedFolderId);
  const selectedFolderNode = findFolderNode(treeQuery.data ?? [], selectedFolderId);
  const selectedFolderCreatedBy = selectedFolderNode?.created_by_name ?? null;

  return (
    <div className="space-y-5">
      <ProjectFilesTitle />

      {treeQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(treeQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {createFolder.error ? (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(createFolder.error)}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Folder className="size-4 text-primary" />
                {selectedProject.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                {canEditFiles ? (
                  <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Nouvelle section"
                    onClick={() => onCreateSection(selectedFolderId)}
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Importer un fichier"
                    onClick={() => onPickFile(selectedFolderId)}
                  >
                    <Upload className="size-4" />
                  </Button>
                  {selectedFolderId != null && selectedFolderName ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Renommer le dossier selectionne"
                      onClick={() => requestRename({ type: "folder", id: selectedFolderId, name: selectedFolderName })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  {canDeleteFiles && selectedFolderId != null && selectedFolderName ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Supprimer le dossier selectionne"
                      onClick={() => requestDelete({ type: "folder", id: selectedFolderId, name: selectedFolderName })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <CardContent
                className="pb-4"
                onContextMenuCapture={() => {
                  setContextTarget(
                    selectedFolderId != null && selectedFolderName
                      ? { type: "folder", id: selectedFolderId, name: selectedFolderName }
                      : null,
                  );
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    onUploadFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                {treeQuery.isLoading ? <Skeleton className="h-64 rounded-md" /> : null}
                {!treeQuery.isLoading && canViewFiles ? (
                  <Tree
                    nodes={treeQuery.data ?? []}
                    canEdit={canEditFiles}
                    canDelete={canDeleteFiles}
                    draftFolder={draftFolder}
                    expandedFolderIds={expandedFolderIds}
                    selectedFolderId={selectedFolderId}
                    openingDocumentId={openDocument.isPending ? openDocument.variables : null}
                    onToggleFolder={toggleFolderExpanded}
                    onSelectFolder={setSelectedFolderId}
                    onOpenDocument={(documentId) => openDocument.mutate(documentId)}
                    onOpenTask={(taskId) => {
                      const task = normalizeApiList(previewTasksQuery.data).find((t) => t.id === taskId);
                      if (task) setViewingTask(task);
                    }}
                    onDraftFolderChange={(name) => setDraftFolder((draft) => (draft ? { ...draft, name } : draft))}
                    onCommitDraftFolder={onCommitDraftFolder}
                    onCancelDraftFolder={onCancelDraftFolder}
                    onOpenContextMenu={setContextTarget}
                    onRequestRename={requestRename}
                    onRequestDelete={requestDelete}
                    onMoveFolder={canEditFiles ? handleMoveFolder : undefined}
                  />
                ) : null}
              </CardContent>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              {canEditFiles && contextTarget ? (
                <ContextMenuItem onSelect={() => requestRename(contextTarget)}>
                  <Pencil className="size-4" />
                  Renommer
                </ContextMenuItem>
              ) : null}
              {canEditFiles && contextTarget ? <ContextMenuSeparator /> : null}
              {canViewTime && contextTarget?.type === "folder" ? (
                <ContextMenuItem onSelect={() => router.push(buildFolderTimeHref(contextTarget.id))}>
                  <Clock3 className="size-4" />
                  Voir les heures
                </ContextMenuItem>
              ) : null}
              {canRecordTime && contextTarget?.type === "folder" ? (
                <ContextMenuItem onSelect={() => openTimeDraft(contextTarget.id)}>
                  <Clock3 className="size-4" />
                  Ajouter du temps
                </ContextMenuItem>
              ) : null}
              {canViewTasks && contextTarget?.type === "folder" ? (
                <ContextMenuItem onSelect={() => router.push(buildFolderTasksHref(contextTarget.id))}>
                  <ListTodo className="size-4" />
                  Voir les taches
                </ContextMenuItem>
              ) : null}
              {canEditTasks && contextTarget?.type === "folder" ? (
                <ContextMenuItem onSelect={() => openTaskDraft(contextTarget.id)}>
                  <ListTodo className="size-4" />
                  Ajouter une tache
                </ContextMenuItem>
              ) : null}
              {(contextTarget?.type === "folder" && (canViewTime || canRecordTime || canViewTasks || canEditTasks)) ? (
                <ContextMenuSeparator />
              ) : null}
              {canEditFiles ? (
                <>
                  <ContextMenuItem onSelect={() => onCreateSection(contextTarget?.type === "folder" ? contextTarget.id : null)}>
                    <FolderPlus className="size-4" />
                    Nouvelle section
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => onPickFile(contextTarget?.type === "folder" ? contextTarget.id : null)}>
                    <Upload className="size-4" />
                    Importer fichier
                  </ContextMenuItem>
                </>
              ) : null}
              {canEditFiles && canDeleteFiles && contextTarget ? <ContextMenuSeparator /> : null}
              {canDeleteFiles && contextTarget ? (
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => requestDelete(contextTarget)}
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </ContextMenuItem>
              ) : null}
            </ContextMenuContent>
          </ContextMenu>
        </Card>

        <FolderPreviewPanel
          selectedFolderId={selectedFolderId}
          selectedFolderName={selectedFolderName}
          selectedFolderCreatedBy={selectedFolderCreatedBy}
          tasks={normalizeApiList(previewTasksQuery.data)
            .filter((t) => t.status !== "done")
            .filter((t) => descendantFolderIds == null || (t.folder != null && descendantFolderIds.has(t.folder)))
          }
          timeEntries={normalizeApiList(previewTimeEntriesQuery.data).filter(
            (e) => descendantFolderIds == null || (e.folder != null && descendantFolderIds.has(e.folder))
          )}

          canViewTasks={canViewTasks}
          canViewTime={canViewTime}
          isLoadingTasks={previewTasksQuery.isLoading}
          isLoadingTime={previewTimeEntriesQuery.isLoading}
          onOpenTask={setViewingTask}
          onOpenTasks={() =>
            selectedFolderId != null
              ? router.push(buildFolderTasksHref(selectedFolderId))
              : router.push(`/tasks?project=${selectedProjectId}`)
          }
          onOpenTime={() =>
            selectedFolderId != null
              ? router.push(buildFolderTimeHref(selectedFolderId))
              : router.push(`/time?project=${selectedProjectId}`)
          }
        />
      </div>

      <TaskDraftDialog
        open={taskDraftFolderId != null}
        folderName={findFolderName(treeQuery.data ?? [], taskDraftFolderId)}
        folders={treeQuery.data ?? []}
        folderId={taskDraftFolderId}
        title={taskTitle}
        description={taskDescription}
        priority={taskPriority}
        dueDate={taskDueDate}
        isPending={createTask.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setTaskDraftFolderId(null);
          }
        }}
        onTitleChange={setTaskTitle}
        onDescriptionChange={setTaskDescription}
        onFolderChange={setTaskDraftFolderId}
        onPriorityChange={setTaskPriority}
        onDueDateChange={setTaskDueDate}
        onSubmit={submitTaskDraft}
      />
      <TimeDraftDialog
        open={timeDraftFolderId != null}
        folderName={findFolderName(treeQuery.data ?? [], timeDraftFolderId)}
        hours={timeHours}
        minutes={timeMinutes}
        hourlyRate={timeHourlyRate}
        description={timeDescription}
        isPending={createTimeEntry.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setTimeDraftFolderId(null);
          }
        }}
        onHoursChange={setTimeHours}
        onMinutesChange={setTimeMinutes}
        onHourlyRateChange={setTimeHourlyRate}
        onDescriptionChange={setTimeDescription}
        onSubmit={submitTimeDraft}
      />

      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      <TaskDetailModal
        task={viewingTask}
        folderNameById={folderNameById}
        canEdit={false}
        canDelete={false}
        onClose={() => setViewingTask(null)}
      />

      <Dialog open={itemToRename != null} onOpenChange={(open) => !open && setItemToRename(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>
              Modifie le nom affiche dans l&apos;arborescence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-file-item">Nom</Label>
            <Input
              id="rename-file-item"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button type="button" disabled={!renameValue.trim() || renameItem.isPending} onClick={submitRename}>
              {renameItem.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemToDelete != null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cet element ?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{itemToDelete?.name}</span> sera deplace vers la corbeille.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteFolder.isPending || deleteDocument.isPending}
              onClick={confirmDelete}
            >
              {deleteFolder.isPending || deleteDocument.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectFilesTitle() {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">Projet</p>
      <h1 className="mt-1 text-2xl font-semibold">Documents du projet</h1>
    </div>
  );
}

function TimeTotals({ timeEntries }: { timeEntries: TimeEntry[] }) {
  const totals = timeEntries.reduce(
    (acc, e) => ({
      durationMinutes: acc.durationMinutes + e.duration_minutes,
      costAmount: acc.costAmount + Number(e.cost_amount),
      remainingAmount: acc.remainingAmount + Number(e.remaining_amount),
    }),
    { durationMinutes: 0, costAmount: 0, remainingAmount: 0 },
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Synthese</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Temps total</span>
          <span className="font-medium tabular-nums">{formatDuration(totals.durationMinutes)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Montant total</span>
          <span className="font-medium tabular-nums">{formatMoney(totals.costAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Reste a payer</span>
          <span className="font-medium tabular-nums">{formatMoney(totals.remainingAmount)}</span>
        </div>
      </div>
    </div>
  );
}

function FolderPreviewPanel({
  selectedFolderId,
  selectedFolderName,
  selectedFolderCreatedBy,
  tasks,
  timeEntries,
  canViewTasks,
  canViewTime,
  isLoadingTasks,
  isLoadingTime,
  onOpenTask,
  onOpenTasks,
  onOpenTime,
}: {
  selectedFolderId: number | null;
  selectedFolderName: string | null;
  selectedFolderCreatedBy: string | null;
  tasks: Task[];
  timeEntries: TimeEntry[];
  canViewTasks: boolean;
  canViewTime: boolean;
  isLoadingTasks: boolean;
  isLoadingTime: boolean;
  onOpenTask: (task: Task) => void;
  onOpenTasks: () => void;
  onOpenTime: () => void;
}) {
  const headerName = selectedFolderId == null ? "Projet" : selectedFolderName;
  const headerIcon = selectedFolderId == null ? (
    <Folder className="size-4 shrink-0 text-primary" />
  ) : (
    <FolderOpen className="size-4 shrink-0 text-amber-500" />
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="truncate text-sm font-medium">{headerName}</span>
        </div>
        {selectedFolderCreatedBy ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Cree par {selectedFolderCreatedBy}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Apercu du dossier</p>
        )}
      </div>

      {canViewTasks ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <ListTodo className="size-3.5 text-sky-600" />
              Taches
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onOpenTasks}>
              Ouvrir
            </Button>
          </div>
          {isLoadingTasks ? (
            <Skeleton className="h-16 rounded" />
          ) : tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune tache liee.</p>
          ) : (
            <div className="space-y-1">
              {tasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs hover:bg-muted/70"
                  onClick={() => onOpenTask(task)}
                >
                  <span className="truncate">{task.title}</span>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", getStatusClassName(task.status))}>{getStatusLabel(task.status)}</Badge>
                </button>
              ))}
              {tasks.length > 5 ? (
                <p className="text-xs text-muted-foreground">+{tasks.length - 5} autres</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {canViewTime ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Clock3 className="size-3.5 text-primary" />
              Temps
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onOpenTime}>
              Ouvrir
            </Button>
          </div>
          {isLoadingTime ? (
            <Skeleton className="h-12 rounded" />
          ) : timeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune heure liee.</p>
          ) : (
            <TimeTotals timeEntries={timeEntries} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function isFolderDescendantOf(nodes: FolderTreeNode[], ancestorId: number, candidateId: number): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === ancestorId) {
      return node.id === candidateId || containsFolderId(node.children ?? [], candidateId);
    }
    if (isFolderDescendantOf(node.children ?? [], ancestorId, candidateId)) return true;
  }
  return false;
}

function containsFolderId(nodes: FolderTreeNode[], id: number): boolean {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    if (node.id === id) return true;
    if (containsFolderId(node.children ?? [], id)) return true;
  }
  return false;
}

function getDocumentPreviewKind(doc: PreviewDocument): "image" | "pdf" | "none" {
  const mime = doc.mime_type ?? "";
  const ext = (doc.file_name.split(".").pop() ?? "").toLowerCase();

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  return "none";
}

function DocumentPreviewModal({
  document: doc,
  onClose,
}: {
  document: PreviewDocument | null;
  onClose: () => void;
}) {
  const kind = doc ? getDocumentPreviewKind(doc) : "none";

  return (
    <Dialog open={doc != null} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          <DialogTitle className="sr-only">{doc?.file_name ?? "Apercu"}</DialogTitle>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <span className="truncate text-sm font-medium">{doc?.file_name ?? "Apercu"}</span>
            <div className="flex shrink-0 items-center gap-2">
              {doc ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm">
                    <Download className="size-4" />
                    Telecharger
                  </Button>
                </a>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">Fermer</Button>
              </DialogClose>
            </div>
          </div>
          {doc ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              {kind === "image" ? (
                <div className="flex h-full items-center justify-center bg-muted/20 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={doc.url}
                    alt={doc.file_name}
                    className="max-h-full w-auto object-contain"
                  />
                </div>
              ) : kind === "pdf" ? (
                <object
                  data={doc.url}
                  type="application/pdf"
                  className="h-full w-full"
                  aria-label={doc.file_name}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <p>Impossible d&apos;afficher le PDF dans le navigateur.</p>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline">
                        <Download className="size-4" />
                        Ouvrir le PDF
                      </Button>
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">Apercu non disponible pour ce type de fichier.</p>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <Button type="button">
                      <Download className="size-4" />
                      Telecharger {doc.file_name}
                    </Button>
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function TaskDraftDialog({
  open,
  folderName,
  folders,
  folderId,
  title,
  description,
  priority,
  dueDate,
  isPending,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onPriorityChange,
  onDueDateChange,
  onSubmit,
}: {
  open: boolean;
  folderName: string | null;
  folders: FolderTreeNode[];
  folderId: number | null;
  title: string;
  description: string;
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (folderId: number | null) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle tache</DialogTitle>
          <DialogDescription>
            {folderName ? `La tache sera liee au dossier ${folderName}.` : "La tache sera liee au projet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dossier</Label>
            <FolderTreePickerDialog
              folders={folders}
              selectedFolderId={folderId}
              buttonLabel={folderName ?? "Projet"}
              description="Selectionne le dossier qui recevra la tache."
              onSelect={onFolderChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-task-title">Titre</Label>
            <Input id="project-task-title" value={title} onChange={(event) => onTitleChange(event.target.value)} />
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
              <Label htmlFor="project-task-due-date">Echeance</Label>
              <Input id="project-task-due-date" type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-task-description">Description</Label>
            <Textarea id="project-task-description" rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="button" disabled={!title.trim() || isPending} onClick={onSubmit}>
            {isPending ? "Creation..." : "Creer la tache"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeDraftDialog({
  open,
  folderName,
  hours,
  minutes,
  hourlyRate,
  description,
  isPending,
  onOpenChange,
  onHoursChange,
  onMinutesChange,
  onHourlyRateChange,
  onDescriptionChange,
  onSubmit,
}: {
  open: boolean;
  folderName: string | null;
  hours: string;
  minutes: string;
  hourlyRate: string;
  description: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const durationMinutes = Number(hours) * 60 + Number(minutes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter du temps</DialogTitle>
          <DialogDescription>
            {folderName ? `Le temps sera lie au dossier ${folderName}.` : "Le temps sera lie au projet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="project-time-hours">Heures</Label>
              <Input id="project-time-hours" type="number" min="0" value={hours} onChange={(event) => onHoursChange(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-time-minutes">Minutes</Label>
              <Input id="project-time-minutes" type="number" min="0" max="59" value={minutes} onChange={(event) => onMinutesChange(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-time-rate">Taux horaire</Label>
            <Input id="project-time-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => onHourlyRateChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-time-description">Description</Label>
            <Textarea id="project-time-description" rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="button" disabled={durationMinutes <= 0 || isPending} onClick={onSubmit}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskTreeBadge({ status }: { status?: FolderTreeNode["status"] }) {
  return (
    <Badge variant="outline" className={status === "in_progress" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-muted bg-background text-muted-foreground"}>
      {status === "in_progress" ? "En cours" : "A faire"}
    </Badge>
  );
}

function Tree({
  nodes,
  canEdit,
  canDelete,
  draftFolder,
  expandedFolderIds,
  selectedFolderId,
  openingDocumentId,
  onToggleFolder,
  onSelectFolder,
  onOpenDocument,
  onOpenTask,
  onDraftFolderChange,
  onCommitDraftFolder,
  onCancelDraftFolder,
  onOpenContextMenu,
  onRequestRename,
  onRequestDelete,
  onMoveFolder,
}: {
  nodes: FolderTreeNode[];
  canEdit: boolean;
  canDelete: boolean;
  draftFolder: { parentFolder: number | null; name: string } | null;
  expandedFolderIds: Set<number>;
  selectedFolderId: number | null;
  openingDocumentId: number | null | undefined;
  onToggleFolder: (folderId: number) => void;
  onSelectFolder: (folderId: number | null) => void;
  onOpenDocument: (documentId: number) => void;
  onOpenTask: (taskId: number) => void;
  onDraftFolderChange: (name: string) => void;
  onCommitDraftFolder: () => void;
  onCancelDraftFolder: () => void;
  onOpenContextMenu: (target: FileActionTarget) => void;
  onRequestRename: (target: FileActionTarget) => void;
  onRequestDelete: (target: FileActionTarget) => void;
  onMoveFolder?: (folderId: number, newParentId: number | null) => void;
}) {
  const [draggedFolderId, setDraggedFolderId] = useState<number | null>(null);

  if (nodes.length === 0) {
    if (draftFolder?.parentFolder === null) {
      return (
        <DraftFolderRow
          depth={0}
          name={draftFolder.name}
          onChange={onDraftFolderChange}
          onCommit={onCommitDraftFolder}
          onCancel={onCancelDraftFolder}
        />
      );
    }

    return (
      <Empty className="border p-8">
        <EmptyHeader>
          <EmptyTitle>Aucun espace ou fichier</EmptyTitle>
          <EmptyDescription>Aucun espace ou fichier dans ce projet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="select-none py-1 text-sm">
      {draftFolder?.parentFolder === null ? (
        <DraftFolderRow
          depth={0}
          name={draftFolder.name}
          onChange={onDraftFolderChange}
          onCommit={onCommitDraftFolder}
          onCancel={onCancelDraftFolder}
        />
      ) : null}
      {nodes.map((node) => (
        <TreeNode
          key={`${node.type}-${node.id}`}
          node={node}
          depth={0}
          canEdit={canEdit}
          canDelete={canDelete}
          draftFolder={draftFolder}
          expandedFolderIds={expandedFolderIds}
          selectedFolderId={selectedFolderId}
          openingDocumentId={openingDocumentId}
          draggedFolderId={draggedFolderId}
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenDocument={onOpenDocument}
          onOpenTask={onOpenTask}
          onDraftFolderChange={onDraftFolderChange}
          onCommitDraftFolder={onCommitDraftFolder}
          onCancelDraftFolder={onCancelDraftFolder}
          onOpenContextMenu={onOpenContextMenu}
          onRequestRename={onRequestRename}
          onRequestDelete={onRequestDelete}
          onDragStart={setDraggedFolderId}
          onDragEnd={() => setDraggedFolderId(null)}
          onDropOnFolder={onMoveFolder}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  canEdit,
  canDelete,
  draftFolder,
  expandedFolderIds,
  selectedFolderId,
  openingDocumentId,
  draggedFolderId,
  onToggleFolder,
  onSelectFolder,
  onOpenDocument,
  onOpenTask,
  onDraftFolderChange,
  onCommitDraftFolder,
  onCancelDraftFolder,
  onOpenContextMenu,
  onRequestRename,
  onRequestDelete,
  onDragStart,
  onDragEnd,
  onDropOnFolder,
}: {
  node: FolderTreeNode;
  depth: number;
  canEdit: boolean;
  canDelete: boolean;
  draftFolder: { parentFolder: number | null; name: string } | null;
  expandedFolderIds: Set<number>;
  selectedFolderId: number | null;
  openingDocumentId: number | null | undefined;
  draggedFolderId: number | null;
  onToggleFolder: (folderId: number) => void;
  onSelectFolder: (folderId: number | null) => void;
  onOpenDocument: (documentId: number) => void;
  onOpenTask: (taskId: number) => void;
  onDraftFolderChange: (name: string) => void;
  onCommitDraftFolder: () => void;
  onCancelDraftFolder: () => void;
  onOpenContextMenu: (target: FileActionTarget) => void;
  onRequestRename: (target: FileActionTarget) => void;
  onRequestDelete: (target: FileActionTarget) => void;
  onDragStart: (folderId: number) => void;
  onDragEnd: () => void;
  onDropOnFolder?: (folderId: number, newParentId: number | null) => void;
}): ReactNode {
  const isFolder = node.type === "folder";
  const isTask = node.type === "task";
  const actionTarget: FileActionTarget | null = isTask
    ? null
    : { type: isFolder ? "folder" : "document", id: node.id, name: node.name };
  const children = node.children ?? [];
  const hasChildren = children.length > 0 || draftFolder?.parentFolder === node.id;
  const isExpanded = isFolder && expandedFolderIds.has(node.id);
  const isSelected = isFolder && selectedFolderId === node.id;
  const isOpeningDocument = !isFolder && openingDocumentId === node.id;
  const isDragTarget = isFolder && draggedFolderId != null && draggedFolderId !== node.id;
  const rowPaddingLeft = getTreeRowPadding(depth);

  return (
    <div className="relative">
      {depth > 0 ? (
        <span
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-border/60"
          style={{ left: `${rowPaddingLeft - 12}px` }}
        />
      ) : null}
      <div
        className={cn(
          "group grid h-9 grid-cols-[24px_20px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md pr-2 text-sm hover:bg-muted/70",
          isSelected && "bg-primary/10 hover:bg-primary/15",
          isDragTarget && "ring-2 ring-primary/40",
        )}
        style={{ paddingLeft: `${rowPaddingLeft}px` }}
        draggable={isFolder && canEdit}
        onDragStart={isFolder && canEdit ? (e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/plain", String(node.id));
          e.dataTransfer.effectAllowed = "move";
          onDragStart(node.id);
        } : undefined}
        onDragEnd={isFolder && canEdit ? () => onDragEnd() : undefined}
        onDragOver={isDragTarget ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
        } : undefined}
        onDrop={isDragTarget ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          const folderId = Number(e.dataTransfer.getData("text/plain"));
          if (folderId && folderId !== node.id) {
            onDropOnFolder?.(folderId, node.id);
          }
          onDragEnd();
        } : undefined}
        onContextMenu={() => {
          if (actionTarget) {
            onOpenContextMenu(actionTarget);
          }
        }}
      >
        {isFolder ? (
          <button
            type="button"
            aria-label={isExpanded ? "Replier le dossier" : "Deplier le dossier"}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFolder(node.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
            ) : (
              <span className="size-4" />
            )}
          </button>
        ) : (
          <span className="size-6" />
        )}

        <button
          type="button"
          className="contents text-left"
          onClick={() => {
            if (isFolder) {
              onSelectFolder(node.id);
              return;
            }

            if (isTask) {
              onOpenTask(node.id);
              return;
            }

            onOpenDocument(node.id);
          }}
        >
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="size-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="size-4 shrink-0 text-amber-500" />
            )
          ) : (
            isTask ? (
              <ListTodo className="size-4 shrink-0 text-sky-600" />
            ) : (
              <DocumentIcon node={node} />
            )
          )}
          <span
            className={cn(
              "min-w-0 truncate",
              isFolder ? "font-medium" : isTask ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              isOpeningDocument && "opacity-60",
            )}
          >
            {node.name}
          </span>
          {isTask ? (
            <TaskTreeBadge status={node.status} />
          ) : !isFolder && node.file_size ? (
            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(node.file_size)}</span>
          ) : (
            <span />
          )}
        </button>
        {!isTask && (canEdit || canDelete) ? (
          <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Renommer ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestRename(actionTarget!);
                }}
              >
                <Pencil className="size-3" />
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Supprimer ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestDelete(actionTarget!);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isFolder && isExpanded ? (
        <div>
          {draftFolder?.parentFolder === node.id ? (
            <DraftFolderRow
              depth={depth + 1}
              name={draftFolder.name}
              onChange={onDraftFolderChange}
              onCommit={onCommitDraftFolder}
              onCancel={onCancelDraftFolder}
            />
          ) : null}
          {children.map((child) => (
            <TreeNode
              key={`${child.type}-${child.id}`}
              node={child}
              depth={depth + 1}
              canEdit={canEdit}
              canDelete={canDelete}
              draftFolder={draftFolder}
              expandedFolderIds={expandedFolderIds}
              selectedFolderId={selectedFolderId}
              openingDocumentId={openingDocumentId}
              draggedFolderId={draggedFolderId}
              onToggleFolder={onToggleFolder}
              onSelectFolder={onSelectFolder}
              onOpenDocument={onOpenDocument}
              onOpenTask={onOpenTask}
              onDraftFolderChange={onDraftFolderChange}
              onCommitDraftFolder={onCommitDraftFolder}
              onCancelDraftFolder={onCancelDraftFolder}
              onOpenContextMenu={onOpenContextMenu}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDropOnFolder={onDropOnFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} o`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getTreeRowPadding(depth: number) {
  return depth * TREE_INDENT + TREE_ROW_PADDING;
}

function getTreeContentPadding(depth: number) {
  return getTreeRowPadding(depth) + 32;
}

function DocumentIcon({ node }: { node: FolderTreeNode }) {
  const { Icon, className } = getDocumentIconConfig(node);

  return <Icon className={cn("size-4 shrink-0", className)} />;
}

function getDocumentIconConfig(node: FolderTreeNode): {
  Icon: ComponentType<{ className?: string }>;
  className: string;
} {
  const fileName = (node.file_name || node.name).toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  const mimeType = node.mime_type?.toLowerCase() ?? "";

  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif"].includes(extension ?? "")) {
    return { Icon: FileImage, className: "text-sky-600" };
  }

  if (["xls", "xlsx", "csv"].includes(extension ?? "")) {
    return { Icon: FileSpreadsheet, className: "text-emerald-600" };
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(extension ?? "")) {
    return { Icon: FileArchive, className: "text-violet-600" };
  }

  if (["html", "css", "js", "jsx", "ts", "tsx", "json", "xml"].includes(extension ?? "")) {
    return { Icon: FileCode, className: "text-fuchsia-600" };
  }

  if (["pdf", "doc", "docx", "txt", "md", "rtf"].includes(extension ?? "")) {
    return { Icon: FileText, className: "text-muted-foreground" };
  }

  return { Icon: FileType, className: "text-muted-foreground" };
}

function DraftFolderRow({
  depth,
  name,
  onChange,
  onCommit,
  onCancel,
}: {
  depth: number;
  name: string;
  onChange: (name: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-sm bg-muted/50 py-1 pr-2"
      style={{ paddingLeft: `${getTreeContentPadding(depth)}px` }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <Folder className="size-4 shrink-0 text-amber-500" />
      <Input
        autoFocus
        value={name}
        placeholder="Nom de la section"
        className="h-7 max-w-sm bg-background"
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
    </div>
  );
}
