"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntryRowActionsProps {
  entryLabel: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** Edit/delete icon-button pair attached to a clickable entry row (finance,
 * expense requests) — stops click propagation so the row's own onClick
 * (opening the detail modal) doesn't also fire. */
export function EntryRowActions({ entryLabel, canEdit, canDelete, onEdit, onDelete }: EntryRowActionsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Modifier ${entryLabel}`}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Supprimer ${entryLabel}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
