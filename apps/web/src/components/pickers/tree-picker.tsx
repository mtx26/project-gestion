"use client";

import type { FolderTreeNode } from "@project-gestion/types";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, ListTodo } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskStatusBadge } from "@/components/badges/task-status-badge";
import { closeThenNotify } from "@/lib/close-then-notify";
import { addToSet, toggleSetValue } from "@/lib/utils";
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
  findTargetLabel,
  getTargetPayload,
  getTargetTypeFromValue,
} from "@/lib/target-utils";

// ─── Row indentation ─────────────────────────────────────────────────────────

/** Distinct from `TREE_INDENT` in `app/files/lib/file-tree-utils.ts`: this
 * tree's row grid has a narrower icon prefix (`grid-cols-[24px_...]` vs
 * `[24px_20px_...]` for the file browser), so the two indents are sized for
 * different layouts rather than accidentally diverging. */
const TREE_PICKER_INDENT = 22;

function getTreePickerIndent(depth: number): number {
  return depth * TREE_PICKER_INDENT;
}

// ─── Shared icon ────────────────────────────────────────────────────────────

export function TreeIcon({ type, expanded }: { type: "project" | "folder" | "task"; expanded?: boolean }) {
  if (type === "task") return <ListTodo className="size-4 shrink-0 text-sky-600" />;
  if (expanded) return <FolderOpen className="size-4 shrink-0 text-amber-500" />;
  return <Folder className="size-4 shrink-0 text-amber-500" />;
}

// ─── Shared expand/collapse toggle ──────────────────────────────────────────

/** Chevron button that expands/collapses a tree row, or an equally-sized
 * blank spacer when the row has nothing to expand — shared by every tree row
 * (picker and file browser) so the button stays pixel-identical between them. */
export function TreeExpandToggle({
  isExpanded,
  visible,
  onToggle,
  ariaLabel,
}: {
  isExpanded: boolean;
  visible: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  if (!visible) return <span className="size-6" />;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

// ─── Target field ────────────────────────────────────────────────────────────

/** `Field` + `TreePickerDialog` (mode `"target"`) pre-wired to derive the
 * selected label from `folders` — the "Cible" picker shared by every entry
 * form dialog (time, finance, expense requests) that can be attached to the
 * project, a folder, or a task. */
export function TargetField({
  label = "Cible",
  folders,
  value,
  onChange,
  onCreateFolderAction,
}: {
  label?: string;
  folders: FolderTreeNode[];
  value: string;
  onChange: (value: string) => void;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
}) {
  const selectedLabel = useMemo(() => findTargetLabel(folders, value) ?? "Projet", [folders, value]);

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <TreePickerDialog
        mode="target"
        folders={folders}
        selectedValue={value}
        selectedLabel={selectedLabel}
        onSelect={onChange}
        onCreateFolderAction={onCreateFolderAction}
      />
    </Field>
  );
}

// ─── Unified picker dialog ───────────────────────────────────────────────────

type FolderOnlyProps = {
  mode: "folder";
  selectedFolderId: number | null;
  buttonLabel: string;
  onSelect: (folderId: number | null) => void;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
};

type TargetProps = {
  mode: "target";
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
  onCreateFolderAction?: (name: string, parentId: number | null) => Promise<void>;
};

type CommonProps = {
  folders: FolderTreeNode[];
  description?: string;
};

export type TreePickerProps = CommonProps & (FolderOnlyProps | TargetProps);

export function TreePickerDialog(props: TreePickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set(["project"]));
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [creatingInNode, setCreatingInNode] = useState<string | null>(null);

  const onCreateFolderAction = props.onCreateFolderAction;

  const rootNode: PickerNode = useMemo(() => ({ type: "project", children: props.folders }), [props.folders]);

  function toggleExpand(value: string) {
    setExpandedValues((prev) => toggleSetValue(prev, value));
  }

  function handleSelect(value: string) {
    closeThenNotify(setOpen, () => {
      if (props.mode === "folder") {
        const { folder } = getTargetPayload(value);
        props.onSelect(folder);
      } else {
        props.onSelect(value);
      }
    });
  }

  function startCreate(nodeValue: string) {
    setExpandedValues((prev) => addToSet(prev, nodeValue));
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
          <DialogTitle className="pr-6">
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
          <div className="flex items-center justify-end gap-2">
            <Checkbox
              id="tree-picker-include-completed"
              checked={includeCompleted}
              onCheckedChange={(checked) => setIncludeCompleted(checked === true)}
            />
            <Label htmlFor="tree-picker-include-completed" className="font-normal text-muted-foreground">
              Inclure les terminees
            </Label>
          </div>
        ) : null}

        <div role="tree" aria-label="Arborescence" className="max-h-[56vh] overflow-y-auto rounded-md border bg-background p-2">
          <TreeRow
            node={rootNode}
            depth={0}
            selectedValue={selectedValue}
            expandedValues={expandedValues}
            mode={props.mode}
            includeCompleted={includeCompleted}
            creatingInNode={creatingInNode}
            onToggle={toggleExpand}
            onSelect={handleSelect}
            onStartCreate={onCreateFolderAction ? startCreate : undefined}
            onConfirmCreate={onCreateFolderAction}
            onCancelCreate={() => setCreatingInNode(null)}
          />
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tree row ────────────────────────────────────────────────────────────────

/** The synthetic "project" root wraps the top-level `FolderTreeNode[]` in a
 * single O(1) object — real folders/tasks are rendered straight off the
 * backend's own tree, no parallel copy is built. */
type PickerNode = { type: "project"; children: FolderTreeNode[] } | FolderTreeNode;

function getChildNodes(node: PickerNode): FolderTreeNode[] {
  const children = node.type === "project" ? node.children : (node.children ?? []);
  return children.filter((child) => child.type === "folder" || child.type === "task");
}

function TreeRow({
  node,
  depth,
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
  node: PickerNode;
  depth: number;
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

  const value = node.type === "project" ? "project" : `${node.type}-${node.id}`;
  const id = node.type === "project" ? null : node.id;
  const label = node.type === "project" ? "Projet" : node.name;
  const iconType = node.type === "task" ? "task" : node.type === "folder" ? "folder" : "project";
  const childNodes = getChildNodes(node);

  const isExpanded = expandedValues.has(value);
  const hasAnyChildren = childNodes.length > 0;
  const isSelected = selectedValue === value;
  const showInlineCreate = creatingInNode === value;

  return (
    <div>
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSelected}
        aria-expanded={hasAnyChildren ? isExpanded : undefined}
        className="group grid h-9 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-md pr-2 hover:bg-muted/70"
        style={{ paddingLeft: `${getTreePickerIndent(depth)}px` }}
      >
        <TreeExpandToggle
          visible={hasAnyChildren || showInlineCreate}
          isExpanded={isExpanded}
          ariaLabel={isExpanded ? "Replier" : "Deplier"}
          onToggle={() => onToggle(value)}
        />

        <button
          type="button"
          className={`flex min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left ${
            isSelected ? "bg-primary/10 text-primary" : ""
          }`}
          onClick={() => onSelect(value)}
        >
          <TreeIcon type={iconType} />
          <span className="min-w-0 truncate">{label}</span>
          {node.type === "task" && node.status ? (
            <TaskStatusBadge status={node.status} className="ml-auto" />
          ) : null}
        </button>

        {onStartCreate && node.type !== "task" ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label="Nouveau sous-dossier"
            onClick={() => onStartCreate(value)}
          >
            <FolderPlus className="size-3.5" />
          </button>
        ) : (
          <span className="size-6" />
        )}
      </div>

      {(hasAnyChildren || showInlineCreate) && isExpanded ? (
        <div role="group">
          {childNodes.map((child) => (
            <TreeRow
              key={`${child.type}-${child.id}`}
              node={child}
              depth={depth + 1}
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
              depth={depth + 1}
              parentId={id}
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
      style={{ paddingLeft: `${getTreePickerIndent(depth) + 32}px` }}
    >
      <Folder className="size-4 shrink-0 text-amber-500" />
      <Input
        ref={inputRef}
        autoFocus
        className="h-7 flex-1 border-teal-500 ring-1 ring-teal-500/40"
        placeholder="Nom du dossier"
        value={name}
        maxLength={255}
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

