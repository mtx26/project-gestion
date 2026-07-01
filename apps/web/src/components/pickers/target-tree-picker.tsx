"use client";

import type { TargetTreeNode } from "@/lib/target-utils";
import { getTargetTypeFromValue } from "@/lib/target-utils";
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
} from "@/components/ui/dialog";

interface TargetPickerDialogProps {
  targetTree: TargetTreeNode;
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
}

export function TargetPickerDialog({
  targetTree,
  selectedValue,
  selectedLabel,
  onSelect,
  onCreateFolder,
}: TargetPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set(["project"]));
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [creatingInNode, setCreatingInNode] = useState<string | null>(null);

  function toggleNode(value: string) {
    setExpandedValues((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectTarget(value: string) {
    // Ferme d'abord la Dialog, puis notifie le parent au tick suivant : sinon
    // le re-render declenche par onSelect peut interrompre la fermeture de la
    // Dialog Radix et provoquer un clignotement ferme/rouvre/ferme.
    setOpen(false);
    setTimeout(() => onSelect(value), 0);
  }

  function startCreate(nodeValue: string) {
    setExpandedValues((prev) => new Set([...prev, nodeValue]));
    setCreatingInNode(nodeValue);
  }

  const selectedType = getTargetTypeFromValue(selectedValue);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreatingInNode(null); }}>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 w-full justify-start gap-2 px-3 py-2"
        onClick={() => setOpen(true)}
      >
        <TargetIcon type={selectedType} />
        <span className="min-w-0 truncate">{selectedLabel}</span>
      </Button>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choisir une cible</DialogTitle>
          <DialogDescription>Parcours les dossiers et selectionne un dossier ou une tache.</DialogDescription>
        </DialogHeader>

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

        <div className="max-h-[56vh] overflow-y-auto rounded-md border bg-background p-2">
          <TargetTreeRow
            node={targetTree}
            selectedValue={selectedValue}
            expandedValues={expandedValues}
            includeCompleted={includeCompleted}
            creatingInNode={creatingInNode}
            onToggle={toggleNode}
            onSelect={selectTarget}
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

function TargetTreeRow({
  node,
  selectedValue,
  expandedValues,
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
  includeCompleted: boolean;
  creatingInNode: string | null;
  onToggle: (value: string) => void;
  onSelect: (value: string) => void;
  onStartCreate?: (nodeValue: string) => void;
  onConfirmCreate?: (name: string, parentId: number | null) => Promise<void>;
  onCancelCreate: () => void;
}) {
  if (node.type === "task" && !includeCompleted && node.status === "done") return null;

  const isExpanded = expandedValues.has(node.value);
  const showInlineCreate = creatingInNode === node.value;
  const hasAnyChildren = node.children.length > 0;
  const isSelected = selectedValue === node.value;
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
          <TargetIcon type={node.type} />
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
            <TargetTreeRow
              key={child.value}
              node={child}
              selectedValue={selectedValue}
              expandedValues={expandedValues}
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

export function TargetIcon({ type }: { type: TargetTreeNode["type"] }) {
  if (type === "task") return <ListTodo className="size-4 shrink-0 text-sky-600" />;
  return <Folder className="size-4 shrink-0 text-amber-500" />;
}
