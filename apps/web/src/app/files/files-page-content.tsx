"use client";

import type { Task } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import type { TaskDraftFormValues, TimeDraftFormValues } from "@project-gestion/validation";
import { useQuery } from "@tanstack/react-query";
import {
  Clock3,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { ProjectAccessGate } from "@/components/states/project-access-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DialogClose } from "@/components/ui/dialog";
import { DocumentPreviewDialog, type PreviewDocument } from "@/components/dialogs/document-preview-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailModal } from "@/components/dialogs/task-detail-modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName, findFolderNode, isFolderDescendantOf } from "@/lib/folder-utils";
import { buildProjectHref } from "@/lib/url-params";
import { addToSet, toggleSetValue } from "@/lib/utils";
import { useCrudMutation } from "@/lib/use-crud-mutation";
import { validateDocumentFile } from "@/lib/use-document-attachment";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { FileTree } from "./components/file-tree";
import { FileDraftDialogs } from "./components/file-draft-dialogs";
import { FolderPreviewPanel } from "./components/folder-preview-panel";
import { type FileActionTarget } from "./lib/file-tree-utils";

export function FilesPageContent() {
  return (
    <ProjectWorkspaceShell maxWidthClassName="max-w-6xl">
      {(state) => <FilesView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function FilesView({
  user,
  selectedProject,
  projectsQuery,
  openCreateProject,
}: ProjectWorkspaceState) {
  const router = useRouter();
  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canViewFiles = can(permissionCodes.fileView);
  const canEditFiles = can(permissionCodes.fileEdit);
  const canDeleteFiles = can(permissionCodes.fileDelete);
  const canViewTasks = can(permissionCodes.taskView);
  const canEditTasks = can(permissionCodes.taskEdit);
  const canViewTime = can(permissionCodes.timeEntryView);
  const canRecordTime = can(permissionCodes.timeEntryEdit);
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
  const [timeDraftFolderId, setTimeDraftFolderId] = useState<number | null>(null);
  const [draftFolder, setDraftFolder] = useState<{ parentFolder: number | null; name: string } | null>(null);
  const draftClosedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFolderId = selectedFolderState.projectId === selectedProjectId ? selectedFolderState.id : null;

  const treeQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.folders.tree(selectedProject.id, { includeTasks: true })
      : queryKeys.disabled(),
    queryFn: () => api.folders.tree(selectedProject!.id, { includeTasks: true }),
    enabled: Boolean(selectedProject && canViewFiles),
  });

  const previewTasksQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.tasks.list(selectedProject.id, { folderId: selectedFolderId ?? undefined, excludeDone: true })
      : queryKeys.disabled(),
    queryFn: () => api.tasks.list(selectedProject!.id, { folder: selectedFolderId ?? undefined, exclude_done: true }),
    enabled: Boolean(selectedProject && canViewTasks),
  });

  const previewTimeEntriesQuery = useQuery({
    queryKey: selectedProject
      ? queryKeys.timeEntries.list(selectedProject.id, { target: selectedFolderId != null ? `folder-${selectedFolderId}` : undefined })
      : queryKeys.disabled(),
    queryFn: () =>
      api.timeEntries.list(selectedProject!.id, {
        target: selectedFolderId != null ? `folder-${selectedFolderId}` : undefined,
      }),
    enabled: Boolean(selectedProject && canViewTime),
  });

  const openTask = useCrudMutation({
    mutationFn: (taskId: number) => api.tasks.get(selectedProject!.id, taskId),
    errorMessage: "Impossible de charger la tache",
    onSuccess: setViewingTask,
  });

  const createFolder = useCrudMutation({
    mutationFn: ({ name, parentFolder }: { name: string; parentFolder: number | null }) =>
      api.folders.create(selectedProject!.id, { name, parent_folder: parentFolder }),
    invalidateKey: [queryKeys.folders.allTree(selectedProjectId ?? 0), queryKeys.folders.targetTree(selectedProjectId ?? 0)],
    successMessage: "Dossier cree",
  });

  const uploadDocument = useCrudMutation({
    mutationFn: ({ file, folder }: { file: File; folder: number | null }) =>
      api.documents.upload(selectedProject!.id, { file, folder }),
    invalidateKey: queryKeys.folders.allTree(selectedProjectId ?? 0),
    successMessage: "Document uploade",
  });

  const openDocument = useCrudMutation({
    mutationFn: (documentId: number) => api.documents.download(selectedProject!.id, documentId),
    onSuccess: setPreviewDocument,
  });

  const deleteFolder = useCrudMutation({
    mutationFn: (folderId: number) => api.folders.remove(selectedProject!.id, folderId),
    invalidateKey: [queryKeys.folders.allTree(selectedProjectId ?? 0), queryKeys.folders.targetTree(selectedProjectId ?? 0)],
    successMessage: "Dossier supprime",
    onSuccess: (_data, folderId) => {
      setItemToDelete(null);
      setSelectedFolderState((current) =>
        current.projectId === selectedProjectId && current.id === folderId
          ? { projectId: selectedProjectId, id: null }
          : current,
      );
    },
  });

  const deleteDocument = useCrudMutation({
    mutationFn: (documentId: number) => api.documents.remove(selectedProject!.id, documentId),
    invalidateKey: queryKeys.folders.allTree(selectedProjectId ?? 0),
    successMessage: "Document supprime",
    onSuccess: () => setItemToDelete(null),
  });

  const renameItem = useCrudMutation<{ target: FileActionTarget; name: string }>({
    mutationFn: ({ target, name }) =>
      target.type === "folder"
        ? api.folders.update(selectedProject!.id, target.id, { name })
        : api.documents.update(selectedProject!.id, target.id, { name }),
    invalidateKey: [queryKeys.folders.allTree(selectedProjectId ?? 0), queryKeys.folders.targetTree(selectedProjectId ?? 0)],
    successMessage: "Element renomme",
    onSuccess: () => {
      setItemToRename(null);
      setRenameValue("");
    },
  });

  const moveFolder = useCrudMutation({
    mutationFn: ({ folderId, newParentId }: { folderId: number; newParentId: number | null }) =>
      api.folders.update(selectedProject!.id, folderId, { parent_folder: newParentId }),
    invalidateKey: [queryKeys.folders.allTree(selectedProjectId ?? 0), queryKeys.folders.targetTree(selectedProjectId ?? 0)],
    successMessage: "Dossier deplace",
  });

  const createTask = useCrudMutation({
    mutationFn: (values: TaskDraftFormValues) =>
      api.tasks.create(selectedProject!.id, {
        title: values.title,
        description: values.description,
        folder: taskDraftFolderId,
        priority: values.priority,
        status: "todo",
        end_date: values.endDate,
      }),
    invalidateKey: [queryKeys.folders.allTree(selectedProjectId ?? 0), queryKeys.tasks.all(selectedProjectId ?? 0)],
    successMessage: "Tache creee",
    onSuccess: () => setTaskDraftFolderId(null),
  });

  const createTimeEntry = useCrudMutation({
    mutationFn: (values: TimeDraftFormValues) =>
      api.timeEntries.create(selectedProject!.id, {
        user: user!.id,
        folder: timeDraftFolderId,
        start_date: new Date().toISOString(),
        duration_minutes: Number(values.hours) * 60 + Number(values.minutes),
        hourly_rate: values.hourlyRate === "" ? undefined : values.hourlyRate,
        description: values.description,
      }),
    invalidateKey: queryKeys.timeEntries.all(selectedProjectId ?? 0),
    successMessage: "Temps enregistre",
    onSuccess: () => setTimeDraftFolderId(null),
  });

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
      return { projectId: selectedProjectId, ids: toggleSetValue(currentIds, folderId) };
    });
  }

  function onCreateSection(parentFolder: number | null) {
    draftClosedRef.current = false;
    if (parentFolder != null) {
      setExpandedFolderState((current) => {
        const currentIds =
          current.projectId === selectedProjectId && current.ids ? current.ids : rootExpandedFolderIds;
        return { projectId: selectedProjectId, ids: addToSet(currentIds, parentFolder) };
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
  }

  function openTimeDraft(folderId: number | null) {
    setTimeDraftFolderId(folderId);
  }

  function handleMoveFolder(folderId: number, newParentId: number | null) {
    const tree = treeQuery.data ?? [];
    if (newParentId !== null && isFolderDescendantOf(tree, folderId, newParentId)) return;
    moveFolder.mutate({ folderId, newParentId });
  }

  function buildFolderTimeHref(folderId: number) {
    return buildProjectHref("/time", selectedProjectId!, new URLSearchParams({ target: `folder-${folderId}` }));
  }

  function buildFolderTasksHref(folderId: number) {
    return buildProjectHref("/tasks", selectedProjectId!, new URLSearchParams({ folder: `folder-${folderId}` }));
  }

  if (projectsQuery.isLoading || !selectedProject || !canViewFiles) {
    return (
      <ProjectAccessGate
        isLoadingProjects={projectsQuery.isLoading}
        hasProject={Boolean(selectedProject)}
        hasAccess={canViewFiles}
        icon={FolderOpen}
        noProjectDescription="Cree ou selectionne un projet pour voir son arborescence."
        accessDeniedDescription="Ton role ne permet pas de voir l'arborescence de ce projet."
        onCreateProject={openCreateProject}
      />
    );
  }

  const selectedFolderName = findFolderName(treeQuery.data ?? [], selectedFolderId);
  const selectedFolderNode = findFolderNode(treeQuery.data ?? [], selectedFolderId);

  return (
    <div className="space-y-5">
      <PageTitle category="Projet" title="Documents du projet" />
      <FormErrorAlert error={getErrorMessage(treeQuery.error)} />

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
                    if (file) {
                      const rejection = validateDocumentFile(file);
                      if (rejection) {
                        toast.error(rejection);
                      } else {
                        uploadDocument.mutate({ file, folder: targetFolderId });
                      }
                    }
                    e.target.value = "";
                  }}
                />
                {treeQuery.isLoading ? <Skeleton className="h-64 rounded-md" /> : null}
                {!treeQuery.isLoading && canViewFiles ? (
                  <FileTree
                    nodes={treeQuery.data ?? []}
                    projectId={selectedProject.id}
                    canEdit={canEditFiles}
                    canDelete={canDeleteFiles}
                    draftFolder={draftFolder}
                    expandedFolderIds={expandedFolderIds}
                    selectedFolderId={selectedFolderId}
                    openingDocumentId={openDocument.isPending ? openDocument.variables : null}
                    onToggleFolder={toggleFolderExpanded}
                    onSelectFolder={setSelectedFolderId}
                    onOpenDocument={(id) => openDocument.mutate(id)}
                    onOpenTask={(taskId) => openTask.mutate(taskId)}
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
          tasks={normalizeApiList(previewTasksQuery.data)}
          timeEntries={normalizeApiList(previewTimeEntriesQuery.data)}
          canViewTasks={canViewTasks}
          canViewTime={canViewTime}
          isLoadingTasks={previewTasksQuery.isLoading}
          isLoadingTime={previewTimeEntriesQuery.isLoading}
          onOpenTask={setViewingTask}
          onOpenTasks={() =>
            selectedFolderId != null
              ? router.push(buildFolderTasksHref(selectedFolderId))
              : router.push(buildProjectHref("/tasks", selectedProjectId!))
          }
          onOpenTime={() =>
            selectedFolderId != null
              ? router.push(buildFolderTimeHref(selectedFolderId))
              : router.push(buildProjectHref("/time", selectedProjectId!))
          }
        />
      </div>

      <FileDraftDialogs
        taskOpen={taskDraftFolderId != null}
        taskFolderName={findFolderName(treeQuery.data ?? [], taskDraftFolderId)}
        taskFolders={treeQuery.data ?? []}
        taskFolderId={taskDraftFolderId}
        taskIsPending={createTask.isPending}
        taskError={createTask.error}
        onTaskOpenChange={(open) => { if (!open) setTaskDraftFolderId(null); }}
        onTaskFolderChange={setTaskDraftFolderId}
        onTaskSubmit={(values: TaskDraftFormValues) => { if (canEditTasks) createTask.mutate(values); }}
        onCreateFolderAction={canEditFiles ? handleCreateFolder : undefined}
        timeOpen={timeDraftFolderId != null}
        timeFolderName={findFolderName(treeQuery.data ?? [], timeDraftFolderId)}
        timeDefaultHourlyRate={user?.profile?.default_hourly_rate ?? "0"}
        timeIsPending={createTimeEntry.isPending}
        timeError={createTimeEntry.error}
        onTimeOpenChange={(open) => { if (!open) setTimeDraftFolderId(null); }}
        onTimeSubmit={(values: TimeDraftFormValues) => { if (user && canRecordTime) createTimeEntry.mutate(values); }}
      />

      <DocumentPreviewDialog document={previewDocument} onClose={() => setPreviewDocument(null)} />

      <TaskDetailModal
        task={viewingTask}
        projectId={selectedProject.id}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingTask(null)}
      />

      <FormDialog
        open={itemToRename != null}
        onOpenChange={(open) => !open && setItemToRename(null)}
        title="Renommer"
        description="Modifie le nom affiche dans l'arborescence."
        maxWidth="md"
        error={getErrorMessage(renameItem.error)}
        footer={
          <>
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
          </>
        }
      >
        <Field>
          <FieldLabel htmlFor="rename-file-item">Nom</FieldLabel>
          <Input
            id="rename-file-item"
            value={renameValue}
            maxLength={255}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (itemToRename && renameValue.trim()) renameItem.mutate({ target: itemToRename, name: renameValue.trim() }); }
            }}
          />
        </Field>
      </FormDialog>

      <ConfirmDeleteDialog
        open={itemToDelete != null}
        title="Supprimer cet element ?"
        description={
          <>
            <span className="font-medium text-foreground">{itemToDelete?.name}</span> sera deplace vers la corbeille.
          </>
        }
        isPending={deleteFolder.isPending || deleteDocument.isPending}
        onConfirm={() => {
          if (!itemToDelete) return;
          if (itemToDelete.type === "folder") deleteFolder.mutate(itemToDelete.id);
          else deleteDocument.mutate(itemToDelete.id);
        }}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
}
