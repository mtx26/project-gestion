"use client";

import type { FolderTreeNode, Task, TaskPayload } from "@project-gestion/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog } from "@/components/pickers/tree-picker";
import { findFolderName } from "@/lib/folder-utils";
import type { FolderFilter } from "../lib/filters";
import { getFolderId } from "../lib/filters";
import type { TaskMember } from "./task-table";

const taskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string(),
  folder: z.string(),
  status: z.enum(["todo", "in_progress", "done"]),
  priority: z.enum(["low", "normal", "high"]),
  startDate: z.string(),
  dueDate: z.string(),
  assignees: z.array(z.number()),
}).refine(
  (v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate,
  { message: "La date de debut ne peut pas depasser l'echeance", path: ["startDate"] },
);
type TaskFormValues = z.infer<typeof taskSchema>;

export function TaskFormDialog({
  mode,
  open,
  task,
  canViewFiles,
  folders,
  members,
  initialFolder,
  isPending,
  error,
  onOpenChange,
  onCreateFolder,
  onSubmit,
}: {
  mode: "create" | "edit";
  open?: boolean;
  task?: Task | null;
  canViewFiles: boolean;
  folders: FolderTreeNode[];
  members: TaskMember[];
  initialFolder?: FolderFilter;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
  onSubmit: (payload: TaskPayload) => void;
}) {
  const isOpen = mode === "create" ? (open ?? false) : task != null;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      folder: task
        ? (task.folder == null ? "all" : `folder-${task.folder}`)
        : (initialFolder ?? "all"),
      status: task?.status ?? "todo",
      priority: task?.priority ?? "normal",
      startDate: task?.start_date ?? "",
      dueDate: task?.due_date ?? "",
      assignees: task?.assigned_to ?? [],
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  function handleSubmit(values: TaskFormValues) {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      folder: getFolderId(values.folder as FolderFilter),
      status: values.status,
      priority: values.priority,
      start_date: values.startDate || null,
      due_date: values.dueDate || null,
      assigned_to: values.assignees,
    });
  }

  const folderValue = useWatch({ control: form.control, name: "folder" });
  const folderId = getFolderId(folderValue as FolderFilter);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle tache" : "Modifier la tache"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Ajoute une tache et rattache-la au bon dossier si necessaire."
              : "Modifie le titre, la cible, le statut et les informations de suivi."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <Field>
            <FieldLabel htmlFor="task-form-title">Titre</FieldLabel>
            <Input id="task-form-title" {...form.register("title")} />
            <FieldError errors={[form.formState.errors.title]} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {canViewFiles ? (
              <Field>
                <FieldLabel>Dossier</FieldLabel>
                <Controller
                  control={form.control}
                  name="folder"
                  render={({ field }) => (
                    <TreePickerDialog
                      mode="folder"
                      folders={folders}
                      selectedFolderId={folderId}
                      buttonLabel={folderId == null ? "Projet" : (findFolderName(folders, folderId) ?? "Dossier")}
                      description="Selectionne le dossier qui recevra la tache."
                      onSelect={(id) => field.onChange(id == null ? "all" : `folder-${id}`)}
                      onCreateFolder={onCreateFolder}
                    />
                  )}
                />
              </Field>
            ) : null}
            {mode === "edit" ? (
              <Field>
                <FieldLabel>Statut</FieldLabel>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">A faire</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="done">Termine</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            ) : (
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="normal">Normale</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>

          {mode === "edit" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Priorite</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="normal">Normale</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Date de debut</FieldLabel>
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Echeance</FieldLabel>
                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Date de debut</FieldLabel>
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Echeance</FieldLabel>
                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
            </div>
          )}
          <FieldError errors={[form.formState.errors.startDate]} />

          {members.length > 0 ? (
            <Field>
              <FieldLabel>Assignes</FieldLabel>
              <Controller
                control={form.control}
                name="assignees"
                render={({ field }) => (
                  <MemberCombobox members={members} value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="task-form-description">Description</FieldLabel>
            <Textarea id="task-form-description" rows={3} {...form.register("description")} />
          </Field>

          <FormErrorAlert error={error} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
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
        className="w-(--radix-popover-trigger-width) gap-0 p-1"
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
