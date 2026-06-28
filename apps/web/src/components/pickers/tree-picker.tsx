"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { ChevronDown, ChevronRight, Folder, FolderPlus, ListTodo } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildTargetTree,
  findTargetLabel,
  getTargetPayload,
  getTargetTypeFromValue,
  getTargetValueFromEntry,
  type TargetTreeNode,
} from "@/lib/target-utils";

export type { TargetTreeNode };
export { buildTargetTree, findTargetLabel, getTargetPayload, getTargetTypeFromValue, getTargetValueFromEntry };

// ─── Shared icon ────────────────────────────────────────────────────────────

export function TreeIcon({ type }: { type: "project" | "folder" | "task" }) {
  if (type === "task") return <ListTodo className="size-4 shrink-0 text-sky-600" />;
  return <Folder className="size-4 shrink-0 text-amber-500" />;
}

// ─── Unified picker dialog ───────────────────────────────────────────────────

type FolderOnlyProps = {
  mode: "folder";
  selectedFolderId: number | null;
  buttonLabel: string;
  onSelect: (folderId: number | null) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
};

type TargetProps = {
  mode: "target";
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
};

type CommonProps = {
  folders: FolderTreeNode[];
  description?: string;
};

export type TreePickerProps = CommonProps & (FolderOnlyProps | TargetProps);

export function TreePickerDialog(props: TreePickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set(["project"]));
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [creatingInNode, setCreatingInNode] = useState<string | null>(null);

  const onCreateFolder = props.onCreateFolder;

  const targetTree = buildTargetTree(props.folders);

  function toggleExpand(value: string) {
    setExpandedValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSelect(value: string) {
    if (props.mode === "folder") {
      const { folder } = getTargetPayload(value);
      props.onSelect(folder);
    } else {
      props.onSelect(value);
    }
    setOpen(false);
  }

  function startCreate(nodeValue: string) {
    setExpandedValues((prev) => new Set([...prev, nodeValue]));
    setCreatingInNode(nodeValue);
  }

  const selectedValue =
    props.mode === "folder"
      ? props.selectedFolderId == null
        ? "project"
        : `folder-${props.selectedFolderId}`
      : props.selectedValue;

  const buttonLabel =
    props.mode === "folder"
      ? props.buttonLabel
      : props.selectedLabel;

  const selectedType = getTargetTypeFromValue(selectedValue);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreatingInNode(null); }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-start gap-2 bg-background px-3"
        >
          <TreeIcon type={selectedType} />
          <span className="min-w-0 truncate">{buttonLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "folder" ? "Choisir un dossier" : "Choisir une cible"}
          </DialogTitle>
          {props.description ? (
            <DialogDescription>{props.description}</DialogDescription>
          ) : (
            <DialogDescription>
              {props.mode === "folder"
                ? "Parcours les dossiers et selectionne un dossier."
                : "Parcours les dossiers et selectionne un dossier ou une tache."}
            </DialogDescription>
          )}
        </DialogHeader>

        {props.mode === "target" ? (
          <div className="flex items-center justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
              <input
                type="checkbox"
                className="size-4 rounded"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
              />
              Inclure les terminees
            </label>
          </div>
        ) : null}

        <div className="max-h-[56vh] overflow-y-auto rounded-md border bg-background p-2">
          <TreeRow
            node={targetTree}
            selectedValue={selectedValue}
            expandedValues={expandedValues}
            mode={props.mode}
            includeCompleted={includeCompleted}
            creatingInNode={creatingInNode}
            onToggle={toggleExpand}
            onSelect={handleSelect}
            onStartCreate={onCreateFolder ? startCreate : undefined}
            onConfirmCreate={onCreateFolder}
            onCancelCreate={() => setCreatingInNode(null)}
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

// ─── Tree row ────────────────────────────────────────────────────────────────

function TreeRow({
  node,
  selectedValue,
  expandedValues,
  mode,
  includeCompleted,
  creatingInNode,
  onToggle,
  onSelect,
  onStartCreate,
  onConfirmCreate,
  onCancelCreate,
}: {
  node: TargetTreeNode;
  selectedValue: string;
  expandedValues: Set<string>;
  mode: "folder" | "target";
  includeCompleted: boolean;
  creatingInNode: string | null;
  onToggle: (value: string) => void;
  onSelect: (value: string) => void;
  onStartCreate?: (nodeValue: string) => void;
  onConfirmCreate?: (name: string, parentId: number | null) => Promise<void>;
  onCancelCreate: () => void;
}) {
  if (mode === "folder" && node.type === "task") return null;
  if (node.type === "task" && !includeCompleted && node.status === "done") return null;

  const isExpanded = expandedValues.has(node.value);
  const hasAnyChildren = node.children.length > 0;
  const isSelected = selectedValue === node.value;
  const showInlineCreate = creatingInNode === node.value;

  const folderId = node.type === "project" ? null : Number(node.value.replace(`${node.type}-`, ""));

  return (
    <div>
      <div
        className="group grid h-9 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-md pr-2 hover:bg-muted/70"
        style={{ paddingLeft: `${node.depth * 22}px` }}
      >
        {hasAnyChildren || showInlineCreate ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isExpanded ? "Replier" : "Deplier"}
            onClick={() => onToggle(node.value)}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-6" />
        )}

        <button
          type="button"
          className={`flex min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left ${
            isSelected ? "bg-primary/10 text-primary" : ""
          }`}
          onClick={() => onSelect(node.value)}
        >
          <TreeIcon type={node.type} />
          <span className="min-w-0 truncate">{node.label}</span>
          {node.type === "task" && node.status ? (
            <TaskStatusBadge status={node.status} />
          ) : null}
        </button>

        {onStartCreate && node.type !== "task" ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label="Nouveau sous-dossier"
            onClick={() => onStartCreate(node.value)}
          >
            <FolderPlus className="size-3.5" />
          </button>
        ) : (
          <span className="size-6" />
        )}
      </div>

      {(hasAnyChildren || showInlineCreate) && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.value}
              node={child}
              selectedValue={selectedValue}
              expandedValues={expandedValues}
              mode={mode}
              includeCompleted={includeCompleted}
              creatingInNode={creatingInNode}
              onToggle={onToggle}
              onSelect={onSelect}
              onStartCreate={onStartCreate}
              onConfirmCreate={onConfirmCreate}
              onCancelCreate={onCancelCreate}
            />
          ))}
          {showInlineCreate ? (
            <InlineFolderInput
              depth={node.depth + 1}
              parentId={folderId}
              onConfirm={onConfirmCreate!}
              onCancel={onCancelCreate}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Inline folder input ─────────────────────────────────────────────────────

function InlineFolderInput({
  depth,
  parentId,
  onConfirm,
  onCancel,
}: {
  depth: number;
  parentId: number | null;
  onConfirm: (name: string, parentId: number | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      await onConfirm(trimmed, parentId);
      onCancel();
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="flex h-9 items-center gap-2 pr-2"
      style={{ paddingLeft: `${depth * 22 + 32}px` }}
    >
      <Folder className="size-4 shrink-0 text-amber-500" />
      <input
        ref={inputRef}
        autoFocus
        className="h-7 flex-1 rounded-md border border-teal-500 bg-background px-2 text-sm outline-none ring-1 ring-teal-500/40 placeholder:text-muted-foreground"
        placeholder="Nom du dossier"
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (!submittingRef.current) onCancel(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
      />
    </div>
  );
}

function TaskStatusBadge({ status }: { status: "todo" | "in_progress" | "done" }) {
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="ml-auto shrink-0 border-blue-200 bg-blue-50 text-blue-700">
        En cours
      </Badge>
    );
  }
  if (status === "done") {
    return (
      <Badge variant="outline" className="ml-auto shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
        Termine
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-auto shrink-0 border-slate-200 bg-slate-50 text-slate-600">
      A faire
    </Badge>
  );
}
