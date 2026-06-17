"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FolderTreePickerDialog({
  folders,
  selectedFolderId,
  buttonLabel,
  description,
  onSelect,
}: {
  folders: FolderTreeNode[];
  selectedFolderId: number | null;
  buttonLabel: string;
  description?: string;
  onSelect: (folderId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  function selectFolder(folderId: number | null) {
    onSelect(folderId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Folder className="size-4 text-amber-500" />
        <span className="truncate">{buttonLabel}</span>
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choisir un dossier</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-background p-2">
          <button
            type="button"
            className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted ${selectedFolderId === null ? "bg-primary/10 text-primary" : ""}`}
            onClick={() => selectFolder(null)}
          >
            <Folder className="size-4 text-primary" />
            Projet
          </button>
          <FolderTreeItems
            nodes={folders}
            selectedFolderId={selectedFolderId}
            depth={0}
            onSelect={selectFolder}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderTreeItems({
  nodes,
  selectedFolderId,
  depth,
  onSelect,
}: {
  nodes: FolderTreeNode[];
  selectedFolderId: number | null;
  depth: number;
  onSelect: (folderId: number | null) => void;
}) {
  return (
    <>
      {nodes.map((node) =>
        node.type === "folder" ? (
          <FolderTreeItem
            key={node.id}
            node={node}
            selectedFolderId={selectedFolderId}
            depth={depth}
            onSelect={onSelect}
          />
        ) : null,
      )}
    </>
  );
}

function FolderTreeItem({
  node,
  selectedFolderId,
  depth,
  onSelect,
}: {
  node: FolderTreeNode;
  selectedFolderId: number | null;
  depth: number;
  onSelect: (folderId: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const childFolders = (node.children ?? []).filter((n) => n.type === "folder");
  const hasChildren = childFolders.length > 0;
  const isSelected = selectedFolderId === node.id;

  return (
    <div>
      <div
        className={`flex h-9 items-center gap-1 rounded-md pr-2 hover:bg-muted ${isSelected ? "bg-primary/10 text-primary" : ""}`}
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted/60"
          onClick={() => setExpanded(!expanded)}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
          ) : (
            <span className="size-4" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(node.id)}
        >
          <Folder className="size-4 shrink-0 text-amber-500" />
          <span className="truncate text-sm">{node.name}</span>
        </button>
      </div>
      {expanded && hasChildren ? (
        <FolderTreeItems
          nodes={childFolders}
          selectedFolderId={selectedFolderId}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}
