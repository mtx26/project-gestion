"use client";

import type { TargetTreeNode } from "@/lib/target-utils";
import { getTargetTypeFromValue } from "@/lib/target-utils";
import { ChevronDown, ChevronRight, Clock3, Folder, ListTodo } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 w-full justify-start gap-2 px-3 py-2"
        onClick={() => setOpen(true)}
      >
        <TargetIcon type={getTargetTypeFromValue(selectedValue)} />
        <span className="min-w-0 truncate">{selectedLabel}</span>
      </Button>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choisir une cible</DialogTitle>
          <DialogDescription>Parcours les dossiers et selectionne un dossier ou une tache.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[56vh] overflow-y-auto rounded-md border bg-background p-2">
          <TargetTreeRow
            node={targetTree}
            selectedValue={selectedValue}
            expandedValues={expandedValues}
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
  onToggle,
  onSelect,
}: {
  node: TargetTreeNode;
  selectedValue: string;
  expandedValues: Set<string>;
  onToggle: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const isExpanded = expandedValues.has(node.value);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedValue === node.value;

  return (
    <div>
      <div
        className="grid h-9 grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-md pr-2 hover:bg-muted/70"
        style={{ paddingLeft: `${node.depth * 22}px` }}
      >
        {hasChildren ? (
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
          {node.type === "task" ? (
            <Badge variant="outline" className="ml-auto shrink-0 border-sky-200 bg-sky-50 text-sky-700">
              Tache
            </Badge>
          ) : null}
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div>
          {node.children.map((child) => (
            <TargetTreeRow
              key={child.value}
              node={child}
              selectedValue={selectedValue}
              expandedValues={expandedValues}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TargetIcon({ type }: { type: TargetTreeNode["type"] }) {
  if (type === "task") return <ListTodo className="size-4 shrink-0 text-sky-600" />;
  if (type === "folder") return <Folder className="size-4 shrink-0 text-amber-500" />;
  return <Clock3 className="size-4 shrink-0 text-primary" />;
}
