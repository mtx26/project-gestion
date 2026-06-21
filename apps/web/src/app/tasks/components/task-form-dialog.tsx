"use client";

import type { FolderTreeNode, Task } from "@project-gestion/types";
import { Check, X } from "lucide-react";
import React, { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/ui/tree-picker";
import { findFolderName } from "@/lib/folder-utils";
import type { FolderFilter } from "../lib/filters";
import { getFolderId } from "../lib/filters";
import type { TaskMember } from "./task-table";

export function TaskFormDialog({
  mode,
  open,
  task,
  canViewFiles,
  folders,
  members,
  assignees,
  title,
  description,
  folder,
  status,
  priority,
  dueDate,
  isPending,
  error,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onFolderChange,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onAssigneesChange,
  onCreateFolder,
  onSubmit,
}: {
  mode: "create" | "edit";
  open?: boolean;
  task?: Task | null;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  members: TaskMember[];
  assignees: number[];
  title: string;
  description: string;
  folder: FolderFilter;
  status?: Task["status"];
  priority: Task["priority"];
  dueDate: string;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFolderChange: (value: FolderFilter) => void;
  onStatusChange?: (value: Task["status"]) => void;
  onPriorityChange: (value: Task["priority"]) => void;
  onDueDateChange: (value: string) => void;
  onAssigneesChange: (ids: number[]) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isOpen = mode === "create" ? (open ?? false) : task != null;
  const folderId = getFolderId(folder);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle tache" : "Modifier la tache"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Ajoute une tache et rattache-la au bon dossier si necessaire."
              : "Modifie le titre, la cible, le statut et les informations de suivi."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field>
            <FieldLabel htmlFor="task-form-title">Titre</FieldLabel>
            <Input id="task-form-title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {canViewFiles ? (
              <Field>
                <FieldLabel>Dossier</FieldLabel>
                <TreePickerDialog
                  mode="folder"
                  folders={folders}
                  selectedFolderId={folderId}
                  buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                  description="Selectionne le dossier qui recevra la tache."
                  onSelect={(id) => onFolderChange(id == null ? "all" : `folder-${id}`)}
                  onCreateFolder={onCreateFolder}
                />
              </Field>
            ) : null}
            {mode === "edit" && status !== undefined && onStatusChange ? (
              <Field>
                <FieldLabel>Statut</FieldLabel>
                <Select value={status} onValueChange={(v) => onStatusChange(v as Task["status"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A faire</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="done">Termine</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : mode === "create" ? (
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Select value={priority} onValueChange={(v) => onPriorityChange(v as Task["priority"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {mode === "edit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Select value={priority} onValueChange={(v) => onPriorityChange(v as Task["priority"])}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Echeance</FieldLabel>
                <DatePicker value={dueDate} onChange={onDueDateChange} />
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel>Echeance</FieldLabel>
              <DatePicker value={dueDate} onChange={onDueDateChange} />
            </Field>
          )}

          {members.length > 0 ? (
            <Field>
              <FieldLabel>Assignes</FieldLabel>
              <MemberCombobox members={members} value={assignees} onChange={onAssigneesChange} />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="task-form-description">Description</FieldLabel>
            <Textarea id="task-form-description" rows={3} value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
          </Field>

          <FormErrorAlert error={error} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {mode === "create" ? (isPending ? "Creation..." : "Creer") : (isPending ? "Enregistrement..." : "Enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberCombobox({
  members,
  value,
  onChange,
}: {
  members: TaskMember[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? members.filter((m) => m.user_display_name.toLowerCase().includes(search.toLowerCase()))
    : members;

  function toggle(userId: number) {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
    setSearch("");
    inputRef.current?.focus();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverAnchor asChild>
        <div
          className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 cursor-text"
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        >
          {value.map((uid) => {
            const member = members.find((m) => m.user === uid);
            if (!member) return null;
            return (
              <span
                key={uid}
                className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                {member.user_display_name}
                <button
                  type="button"
                  aria-label={`Retirer ${member.user_display_name}`}
                  className="opacity-50 hover:opacity-100 focus:outline-none"
                  onClick={(e) => { e.stopPropagation(); toggle(uid); }}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !search && value.length > 0) onChange(value.slice(0, -1));
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={value.length === 0 ? "Assigner des membres..." : ""}
            className="min-w-16 flex-1 bg-transparent outline-none"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] gap-0 p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Aucun membre trouve.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.user}
              type="button"
              className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pl-1.5 pr-8 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle(m.user)}
            >
              <span className="flex-1 text-left">{m.user_display_name}</span>
              {value.includes(m.user) ? <Check className="absolute right-2 size-4" /> : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
