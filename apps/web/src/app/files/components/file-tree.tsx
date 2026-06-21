"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListTodo,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { TaskStatusBadge } from "@/components/ui/task-status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type FileActionTarget,
  formatFileSize,
  getDocumentIconConfig,
  getTreeContentPadding,
  getTreeRowPadding,
} from "../lib/file-utils";

function DocumentIcon({ node }: { node: FolderTreeNode }) {
  const { Icon, className } = getDocumentIconConfig(node);
  return <Icon className={cn("size-4 shrink-0", className)} />;
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
      onContextMenu={(e) => e.stopPropagation()}
    >
      <Folder className="size-4 shrink-0 text-amber-500" />
      <Input
        autoFocus
        value={name}
        placeholder="Nom de la section"
        className="h-7 max-w-sm bg-background"
        onBlur={onCommit}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
      />
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
          isDragTarget && "bg-primary/5",
        )}
        style={{ paddingLeft: `${rowPaddingLeft}px` }}
        draggable={isFolder && canEdit}
        onDragStart={
          isFolder && canEdit
            ? (e) => {
                e.stopPropagation();
                e.dataTransfer.setData("text/plain", String(node.id));
                e.dataTransfer.effectAllowed = "move";
                onDragStart(node.id);
              }
            : undefined
        }
        onDragEnd={isFolder && canEdit ? () => onDragEnd() : undefined}
        onDragOver={
          isDragTarget
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
              }
            : undefined
        }
        onDrop={
          isDragTarget
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                const folderId = Number(e.dataTransfer.getData("text/plain"));
                if (folderId && folderId !== node.id) {
                  onDropOnFolder?.(folderId, node.id);
                }
                onDragEnd();
              }
            : undefined
        }
        onContextMenu={() => {
          if (actionTarget) onOpenContextMenu(actionTarget);
        }}
      >
        {isFolder ? (
          <button
            type="button"
            aria-label={isExpanded ? "Replier le dossier" : "Deplier le dossier"}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onToggleFolder(node.id); }}
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
            if (isFolder) { onSelectFolder(node.id); return; }
            if (isTask) { onOpenTask(node.id); return; }
            onOpenDocument(node.id);
          }}
        >
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="size-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="size-4 shrink-0 text-amber-500" />
            )
          ) : isTask ? (
            <ListTodo className="size-4 shrink-0 text-sky-600" />
          ) : (
            <DocumentIcon node={node} />
          )}
          <span
            className={cn(
              "min-w-0 truncate",
              isFolder
                ? "font-medium"
                : isTask
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              isOpeningDocument && "opacity-60",
            )}
          >
            {node.name}
          </span>
          {isTask ? (
            <TaskStatusBadge status={node.status} />
          ) : !isFolder && node.file_size ? (
            <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(node.file_size)}</span>
          ) : (
            <span />
          )}
        </button>

        {!isTask && (canEdit || canDelete) ? (
          <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {canEdit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Renommer ${node.name}`}
                    onClick={(e) => { e.stopPropagation(); onRequestRename(actionTarget!); }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Renommer</TooltipContent>
              </Tooltip>
            ) : null}
            {canDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Supprimer ${node.name}`}
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(actionTarget!); }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
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

export function FileTree({
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
