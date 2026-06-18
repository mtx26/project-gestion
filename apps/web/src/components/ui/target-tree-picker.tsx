"use client";

import type { TargetTreeNode } from "@/lib/target-utils";
import { getTargetTypeFromValue } from "@/lib/target-utils";
import { ChevronDown, ChevronRight, Folder, ListTodo } from "lucide-react";
import { useState } from "react";
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

export function TargetPickerDialog({
  targetTree,
  selectedValue,
  selectedLabel,
  onSelect,
}: {
  targetTree: TargetTreeNode;
  selectedValue: string;
  selectedLabel: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set(["project"]));
  const [includeCompleted, setIncludeCompleted] = useState(false);

  function toggleNode(value: string) {
    setExpandedValues((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectTarget(value: string) {
    onSelect(value);
    setOpen(false);
  }

  const selectedType = getTargetTypeFromValue(selectedValue);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            onToggle={toggleNode}
            onSelect={selectTarget}
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
  onToggle,
  onSelect,
}: {
  node: TargetTreeNode;
  selectedValue: string;
  expandedValues: Set<string>;
  includeCompleted: boolean;
  onToggle: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  if (node.type === "task" && !includeCompleted && node.status === "done") return null;

  const isExpanded = expandedValues.has(node.value);
  const visibleChildren = node.children.filter(
    (c) => c.type !== "task" || includeCompleted || c.status !== "done",
  );
  const hasChildren = visibleChildren.length > 0;
  const isSelected = selectedValue === node.value;

  return (
    <div>
      <div
        className="grid h-9 grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md pr-2 hover:bg-muted/70"
        style={{ paddingLeft: `${node.depth * 22}px` }}
      >
        {hasChildren || node.children.length > 0 ? (
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
      </div>

      {(hasChildren || node.children.length > 0) && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <TargetTreeRow
              key={child.value}
              node={child}
              selectedValue={selectedValue}
              expandedValues={expandedValues}
              includeCompleted={includeCompleted}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
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
