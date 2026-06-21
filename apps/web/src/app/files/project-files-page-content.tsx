"use client";

import type { Task } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Clock3,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Lock,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { Input } from "@/components/ui/input";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailModal } from "@/components/ui/task-detail-modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap, findFolderName, findFolderNode, getDescendantFolderIds } from "@/lib/folder-utils";
import { FileTree } from "./components/file-tree";
import { FileDraftDialogs } from "./components/file-draft-dialogs";
import { FolderPreviewPanel } from "./components/folder-preview-panel";
import { type FileActionTarget, isFolderDescendantOf } from "./lib/file-utils";

export function ProjectFilesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="files"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      maxWidthClassName="max-w-6xl"
      onProjectSelected={(id) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("project", String(id));
        router.push(`/files?${params.toString()}`);
      }}
      onProjectCreated={(project) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("project", String(project.id));
        router.push(`/files?${params.toString()}`);
      }}
    >
      {(state) => <ProjectTreeView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function ProjectTreeView({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
  queryClient,
}: ProjectWorkspaceState) {
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
  }>({ projectId: null, ids: null });
  const [contextTarget, setContextTarget] = useState<FileActionTarget | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FileActionTarget | null>(null);
  const [itemToRename, setItemToRename] = useState<FileActionTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
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

  const previewTasksQuery = useQuery({
    queryKey: selectedProject ? queryKeys.tasks.list(selectedProject.id, {}) : ["tasks", "folder-preview", "disabled"],
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

  const createFolder = useMutation({
    mutationFn: ({ name, parentFolder }: { name: string; parentFolder: number | null }) =>
      api.folders.create(selectedProject!.id, { name, parent_folder: parentFolder }),
    onSuccess: () => { toast.success("Dossier cree"); treeQuery.refetch(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const uploadDocument = useMutation({
    mutationFn: ({ file, folder }: { file: File; folder: number | null }) =>
      api.documents.upload(selectedProject!.id, { file, folder }),
    onSuccess: () => { toast.success("Document uploade"); treeQuery.refetch(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(selectedProject!.id, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteFolder = useMutation({
    mutationFn: (folderId: number) => api.folders.remove(selectedProject!.id, folderId),
    onSuccess: async (_data, folderId) => {
      toast.success("Dossier supprime");
      setItemToDelete(null);
      setSelectedFolderState((current) =>
        current.projectId === selectedProjectId && current.id === folderId
          ? { projectId: selectedProjectId, id: null }
          : current,
      );
      await treeQuery.refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.remove(selectedProject!.id, documentId),
    onSuccess: async () => { toast.success("Document supprime"); setItemToDelete(null); await treeQuery.refetch(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const renameItem = useMutation<unknown, Error, { target: FileActionTarget; name: string }>({
    mutationFn: ({ target, name }) =>
      target.type === "folder"
        ? api.folders.update(selectedProject!.id, target.id, { name })
        : api.documents.update(selectedProject!.id, target.id, { name }),
    onSuccess: async () => {
      toast.success("Element renomme");
      setItemToRename(null);
      setRenameValue("");
      await treeQuery.refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const moveFolder = useMutation({
    mutationFn: ({ folderId, newParentId }: { folderId: number; newParentId: number | null }) =>
      api.folders.update(selectedProject!.id, folderId, { parent_folder: newParentId }),
    onSuccess: async () => treeQuery.refetch(),
    onError: (err) => toast.error(getErrorMessage(err)),
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
    onSuccess: async () => {
      toast.success("Tache creee");
      setTaskDraftFolderId(null);
      setTaskTitle(""); setTaskDescription(""); setTaskPriority("normal"); setTaskDueDate("");
      await Promise.all([
        treeQuery.refetch(),
        selectedProjectId
          ? queryClient.invalidateQueries({ queryKey: ["projects", selectedProjectId, "tasks"] })
          : Promise.resolve(),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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
    onSuccess: async () => {
      toast.success("Temps enregistre");
      setTimeDraftFolderId(null);
      setTimeHours("1"); setTimeMinutes("0");
      setTimeHourlyRate(user?.profile?.default_hourly_rate ?? "0");
      setTimeDescription("");
      if (selectedProjectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects", selectedProjectId, "time-entries"] });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const selectedFolderId = selectedFolderState.projectId === selectedProjectId ? selectedFolderState.id : null;

  const descendantFolderIds = useMemo(
    () => getDescendantFolderIds(treeQuery.data ?? [], selectedFolderId),
    [treeQuery.data, selectedFolderId],
  );

  const folderNameById = useMemo(() => buildFolderNameMap(treeQuery.data ?? []), [treeQuery.data]);

  const rootExpandedFolderIds = useMemo(
    () => new Set((treeQuery.data ?? []).filter((n) => n.type === "folder").map((n) => n.id)),
    [treeQuery.data],
  );
  const expandedFolderIds =
    expandedFolderState.projectId === selectedProjectId && expandedFolderState.ids
      ? expandedFolderState.ids
      : rootExpandedFolderIds;

  function setSelectedFolderId(folderId: number | null) {
    setSelectedFolderState({ projectId: selectedProjectId, id: folderId });
  }

  function toggleFolderExpanded(folderId: number) {
    setExpandedFolderState((current) => {
      const currentIds =
        current.projectId === selectedProjectId && current.ids ? current.ids : rootExpandedFolderIds;
      const next = new Set(currentIds);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return { projectId: selectedProjectId, ids: next };
    });
  }

  function onCreateSection(parentFolder: number | null) {
    draftClosedRef.current = false;
    if (parentFolder != null) {
      setExpandedFolderState((current) => {
        const currentIds =
          current.projectId === selectedProjectId && current.ids ? current.ids : rootExpandedFolderIds;
        return { projectId: selectedProjectId, ids: new Set([...currentIds, parentFolder]) };
      });
    }
    setDraftFolder({ parentFolder, name: "" });
  }

  function onCommitDraftFolder() {
    if (draftClosedRef.current) return;
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

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentFolder: parentId });
  }

  function openTaskDraft(folderId: number | null) {
    setTaskDraftFolderId(folderId);
    setTaskTitle(""); setTaskDescription(""); setTaskPriority("normal"); setTaskDueDate("");
  }

  function openTimeDraft(folderId: number | null) {
    setTimeDraftFolderId(folderId);
    setTimeHours("1"); setTimeMinutes("0");
    setTimeHourlyRate(user?.profile?.default_hourly_rate ?? "0");
    setTimeDescription("");
  }

  function handleMoveFolder(folderId: number, newParentId: number | null) {
    const tree = treeQuery.data ?? [];
    if (newParentId !== null && isFolderDescendantOf(tree, folderId, newParentId)) return;
    moveFolder.mutate({ folderId, newParentId });
  }

  function buildFolderTimeHref(folderId: number) {
    return `/time?${new URLSearchParams({ project: String(selectedProjectId), target: `folder-${folderId}` }).toString()}`;
  }

  function buildFolderTasksHref(folderId: number) {
    return `/tasks?project=${selectedProjectId}&folder=folder-${folderId}`;
  }

  if (projectsQuery.isLoading) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={FolderOpen}
        description="Cree ou selectionne un projet pour voir son arborescence."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewFiles) {
    return (
      <div className="space-y-5">
        <PageTitle category="Projet" title="Documents du projet" />
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Fichiers indisponibles</AlertTitle>
          <AlertDescription>Ton role ne permet pas de voir l&apos;arborescence de ce projet.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedFolderName = findFolderName(treeQuery.data ?? [], selectedFolderId);
  const selectedFolderNode = findFolderNode(treeQuery.data ?? [], selectedFolderId);

  return (
    <div className="space-y-5">
      <PageTitle category="Projet" title="Documents du projet" />
      <FormErrorAlert error={treeQuery.error ? getErrorMessage(treeQuery.error) : null} />

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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon-sm" aria-label="Nouvelle section" onClick={() => onCreateSection(selectedFolderId)}>
                          <FolderPlus className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Nouvelle section</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon-sm" aria-label="Importer un fichier" onClick={() => onPickFile(selectedFolderId)}>
                          <Upload className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Importer un fichier</TooltipContent>
                    </Tooltip>
                    {selectedFolderId != null && selectedFolderName ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Renommer le dossier selectionne"
                            onClick={() => { setItemToRename({ type: "folder", id: selectedFolderId, name: selectedFolderName }); setRenameValue(selectedFolderName); }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Renommer</TooltipContent>
                      </Tooltip>
                    ) : null}
                    {canDeleteFiles && selectedFolderId != null && selectedFolderName ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Supprimer le dossier selectionne"
                            onClick={() => setItemToDelete({ type: "folder", id: selectedFolderId, name: selectedFolderName })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadDocument.mutate({ file, folder: targetFolderId });
                    e.target.value = "";
                  }}
                />
                {treeQuery.isLoading ? <Skeleton className="h-64 rounded-md" /> : null}
                {!treeQuery.isLoading && canViewFiles ? (
                  <FileTree
                    nodes={treeQuery.data ?? []}
                    canEdit={canEditFiles}
                    canDelete={canDeleteFiles}
                    draftFolder={draftFolder}
                    expandedFolderIds={expandedFolderIds}
                    selectedFolderId={selectedFolderId}
                    openingDocumentId={openDocument.isPending ? openDocument.variables : null}
                    onToggleFolder={toggleFolderExpanded}
                    onSelectFolder={setSelectedFolderId}
                    onOpenDocument={(id) => openDocument.mutate(id)}
                    onOpenTask={(taskId) => {
                      const task = normalizeApiList(previewTasksQuery.data).find((t) => t.id === taskId);
                      if (task) setViewingTask(task);
                    }}
                    onDraftFolderChange={(name) => setDraftFolder((d) => (d ? { ...d, name } : d))}
                    onCommitDraftFolder={onCommitDraftFolder}
                    onCancelDraftFolder={onCancelDraftFolder}
                    onOpenContextMenu={setContextTarget}
                    onRequestRename={(target) => { setItemToRename(target); setRenameValue(target.name); }}
                    onRequestDelete={setItemToDelete}
                    onMoveFolder={canEditFiles ? handleMoveFolder : undefined}
                  />
                ) : null}
              </CardContent>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
              {canEditFiles && contextTarget ? (
                <ContextMenuItem onSelect={() => { setItemToRename(contextTarget); setRenameValue(contextTarget.name); }}>
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
              {contextTarget?.type === "folder" &&
              (canViewTime || canRecordTime || canViewTasks || canEditTasks) ? (
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
                <ContextMenuItem variant="destructive" onSelect={() => setItemToDelete(contextTarget)}>
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
          selectedFolderCreatedBy={selectedFolderNode?.created_by_name ?? null}
          tasks={normalizeApiList(previewTasksQuery.data)
            .filter((t) => t.status !== "done")
            .filter((t) => descendantFolderIds == null || (t.folder != null && descendantFolderIds.has(t.folder)))}
          timeEntries={normalizeApiList(previewTimeEntriesQuery.data).filter(
            (e) => descendantFolderIds == null || (e.folder != null && descendantFolderIds.has(e.folder)),
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

      <FileDraftDialogs
        taskOpen={taskDraftFolderId != null}
        taskFolderName={findFolderName(treeQuery.data ?? [], taskDraftFolderId)}
        taskFolders={treeQuery.data ?? []}
        taskFolderId={taskDraftFolderId}
        taskTitle={taskTitle}
        taskDescription={taskDescription}
        taskPriority={taskPriority}
        taskDueDate={taskDueDate}
        taskIsPending={createTask.isPending}
        onTaskOpenChange={(open) => { if (!open) setTaskDraftFolderId(null); }}
        onTaskTitleChange={setTaskTitle}
        onTaskDescriptionChange={setTaskDescription}
        onTaskFolderChange={setTaskDraftFolderId}
        onTaskPriorityChange={setTaskPriority}
        onTaskDueDateChange={setTaskDueDate}
        onTaskSubmit={() => { if (canEditTasks && taskTitle.trim()) createTask.mutate(); }}
        onCreateFolder={canEditFiles ? handleCreateFolder : undefined}
        timeOpen={timeDraftFolderId != null}
        timeFolderName={findFolderName(treeQuery.data ?? [], timeDraftFolderId)}
        timeHours={timeHours}
        timeMinutes={timeMinutes}
        timeHourlyRate={timeHourlyRate}
        timeDescription={timeDescription}
        timeIsPending={createTimeEntry.isPending}
        onTimeOpenChange={(open) => { if (!open) setTimeDraftFolderId(null); }}
        onTimeHoursChange={setTimeHours}
        onTimeMinutesChange={setTimeMinutes}
        onTimeHourlyRateChange={setTimeHourlyRate}
        onTimeDescriptionChange={setTimeDescription}
        onTimeSubmit={() => {
          const durationMinutes = Number(timeHours) * 60 + Number(timeMinutes);
          if (user && canRecordTime && durationMinutes > 0) createTimeEntry.mutate();
        }}
      />

      <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />

      <TaskDetailModal
        task={viewingTask}
        folderNameById={folderNameById}
        members={[]}
        canEdit={false}
        canDelete={false}
        onClose={() => setViewingTask(null)}
      />

      <Dialog open={itemToRename != null} onOpenChange={(open) => !open && setItemToRename(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>Modifie le nom affiche dans l&apos;arborescence.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rename-file-item">Nom</FieldLabel>
            <Input
              id="rename-file-item"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (itemToRename && renameValue.trim()) renameItem.mutate({ target: itemToRename, name: renameValue.trim() }); }
              }}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!renameValue.trim() || renameItem.isPending}
              onClick={() => { if (itemToRename && renameValue.trim()) renameItem.mutate({ target: itemToRename, name: renameValue.trim() }); }}
            >
              {renameItem.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={itemToDelete != null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet element ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{itemToDelete?.name}</span> sera deplace vers la corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteFolder.isPending || deleteDocument.isPending}
              onClick={() => {
                if (!itemToDelete) return;
                if (itemToDelete.type === "folder") deleteFolder.mutate(itemToDelete.id);
                else deleteDocument.mutate(itemToDelete.id);
              }}
            >
              {deleteFolder.isPending || deleteDocument.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
