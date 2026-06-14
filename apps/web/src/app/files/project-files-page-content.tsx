"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type FileActionTarget = {
  type: "folder" | "document";
  id: number;
  name: string;
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

function ProjectTreeView({ user, selectedProject, projectsQuery, openCreateProject }: ProjectWorkspaceState) {
  const canViewFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileView);
  const canEditFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileEdit);
  const canDeleteFiles = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.fileDelete);
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
  const [renameValue, setRenameValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftFolder, setDraftFolder] = useState<{ parentFolder: number | null; name: string } | null>(null);
  const draftClosedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const treeQuery = useQuery({
    queryKey: selectedProject ? queryKeys.folders.tree(selectedProject.id) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(selectedProject!.id),
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
      window.open(data.url, "_blank", "noopener,noreferrer");
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

  const rootExpandedFolderIds = useMemo(() => {
    return new Set((treeQuery.data ?? []).filter((node) => node.type === "folder").map((node) => node.id));
  }, [treeQuery.data]);
  const selectedFolderId = selectedFolderState.projectId === selectedProjectId ? selectedFolderState.id : null;
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

  const selectedFolderName = findFolderName(treeQuery.data ?? [], selectedFolderId);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Projet</p>
        <h1 className="mt-1 text-2xl font-semibold">Arborescence du projet</h1>
        {selectedFolderName ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Dossier selectionne : <span className="font-medium text-foreground">{selectedFolderName}</span>
          </p>
        ) : null}
      </div>

      {!canViewFiles ? (
        <Alert>
          <AlertDescription>Permission file.view requise pour voir l&apos;arborescence du projet.</AlertDescription>
        </Alert>
      ) : null}

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

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Folder className="size-4 text-primary" />
              {selectedProject.name}
            </CardTitle>
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
        </CardHeader>
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={!canEditFiles}>
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
                  onDraftFolderChange={(name) => setDraftFolder((draft) => (draft ? { ...draft, name } : draft))}
                  onCommitDraftFolder={onCommitDraftFolder}
                  onCancelDraftFolder={onCancelDraftFolder}
                  onOpenContextMenu={setContextTarget}
                  onRequestRename={requestRename}
                  onRequestDelete={requestDelete}
                />
              ) : null}
            </CardContent>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {contextTarget ? (
              <ContextMenuItem onSelect={() => requestRename(contextTarget)}>
                <Pencil className="size-4" />
                Renommer
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onSelect={() => onCreateSection(contextTarget?.type === "folder" ? contextTarget.id : null)}>
              <FolderPlus className="size-4" />
              Nouvelle section
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPickFile(contextTarget?.type === "folder" ? contextTarget.id : null)}>
              <Upload className="size-4" />
              Importer fichier
            </ContextMenuItem>
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

function findFolderName(nodes: FolderTreeNode[], folderId: number | null): string | null {
  if (folderId == null) {
    return null;
  }

  for (const node of nodes) {
    if (node.type === "folder" && node.id === folderId) {
      return node.name;
    }

    if (node.children?.length) {
      const nested = findFolderName(node.children, folderId);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
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
  onDraftFolderChange,
  onCommitDraftFolder,
  onCancelDraftFolder,
  onOpenContextMenu,
  onRequestRename,
  onRequestDelete,
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
  onDraftFolderChange: (name: string) => void;
  onCommitDraftFolder: () => void;
  onCancelDraftFolder: () => void;
  onOpenContextMenu: (target: FileActionTarget) => void;
  onRequestRename: (target: FileActionTarget) => void;
  onRequestDelete: (target: FileActionTarget) => void;
}) {
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
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenDocument={onOpenDocument}
          onDraftFolderChange={onDraftFolderChange}
          onCommitDraftFolder={onCommitDraftFolder}
          onCancelDraftFolder={onCancelDraftFolder}
          onOpenContextMenu={onOpenContextMenu}
          onRequestRename={onRequestRename}
          onRequestDelete={onRequestDelete}
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
  onToggleFolder,
  onSelectFolder,
  onOpenDocument,
  onDraftFolderChange,
  onCommitDraftFolder,
  onCancelDraftFolder,
  onOpenContextMenu,
  onRequestRename,
  onRequestDelete,
}: {
  node: FolderTreeNode;
  depth: number;
  canEdit: boolean;
  canDelete: boolean;
  draftFolder: { parentFolder: number | null; name: string } | null;
  expandedFolderIds: Set<number>;
  selectedFolderId: number | null;
  openingDocumentId: number | null | undefined;
  onToggleFolder: (folderId: number) => void;
  onSelectFolder: (folderId: number | null) => void;
  onOpenDocument: (documentId: number) => void;
  onDraftFolderChange: (name: string) => void;
  onCommitDraftFolder: () => void;
  onCancelDraftFolder: () => void;
  onOpenContextMenu: (target: FileActionTarget) => void;
  onRequestRename: (target: FileActionTarget) => void;
  onRequestDelete: (target: FileActionTarget) => void;
}): ReactNode {
  const isFolder = node.type === "folder";
  const actionType: FileActionTarget["type"] = isFolder ? "folder" : "document";
  const children = node.children ?? [];
  const hasChildren = children.length > 0 || draftFolder?.parentFolder === node.id;
  const isExpanded = isFolder && expandedFolderIds.has(node.id);
  const isSelected = isFolder && selectedFolderId === node.id;
  const isOpeningDocument = !isFolder && openingDocumentId === node.id;
  const rowPaddingLeft = getTreeRowPadding(depth);

  function onFolderClick() {
    onSelectFolder(node.id);
    if (hasChildren) {
      onToggleFolder(node.id);
    }
  }

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
        )}
        style={{ paddingLeft: `${rowPaddingLeft}px` }}
        onContextMenu={() => {
          if (canEdit) {
            onOpenContextMenu({ type: actionType, id: node.id, name: node.name });
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
              onFolderClick();
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
            <DocumentIcon node={node} />
          )}
          <span
            className={cn(
              "min-w-0 truncate",
              isFolder ? "font-medium" : "text-muted-foreground hover:text-foreground",
              isOpeningDocument && "opacity-60",
            )}
          >
            {node.name}
          </span>
          {!isFolder && node.file_size ? (
            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(node.file_size)}</span>
          ) : (
            <span />
          )}
        </button>
        {canEdit || canDelete ? (
          <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Renommer ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestRename({ type: actionType, id: node.id, name: node.name });
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
                  onRequestDelete({ type: actionType, id: node.id, name: node.name });
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
              onToggleFolder={onToggleFolder}
              onSelectFolder={onSelectFolder}
              onOpenDocument={onOpenDocument}
              onDraftFolderChange={onDraftFolderChange}
              onCommitDraftFolder={onCommitDraftFolder}
              onCancelDraftFolder={onCancelDraftFolder}
              onOpenContextMenu={onOpenContextMenu}
              onRequestRename={onRequestRename}
              onRequestDelete={onRequestDelete}
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
