"use client";

import type { Task } from "@project-gestion/types";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Pencil, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskPriorityBadge } from "@/components/badges/task-priority-badge";
import { TaskStatusBadge } from "@/components/badges/task-status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, getStatusClassName } from "@/lib/task-utils";

export type TaskMember = { id: number; user: number; user_display_name: string };

const COLUMN_LABELS: Record<string, string> = {
  title: "Tache",
  folder: "Dossier",
  status: "Statut",
  priority: "Priorite",
  due_date: "Echeance",
  assignees: "Assignes",
};

export function TaskTable({
  tasks,
  canEdit,
  canDelete,
  deletingId,
  defaultVisibility = {},
  onOpenDetail,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: Task[];
  canEdit: boolean;
  canDelete: boolean;
  deletingId: number | null | undefined;
  defaultVisibility?: VisibilityState;
  onOpenDetail: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
}) {
  "use no memo";
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultVisibility);

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortButton column={column}>Tache</SortButton>,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: "folder",
        accessorFn: (row) => row.folder_name ?? "",
        header: ({ column }) => <SortButton column={column}>Dossier</SortButton>,
        cell: ({ row }) => {
          const name = row.original.folder == null ? "Projet" : (row.original.folder_name ?? `Dossier #${row.original.folder}`);
          return <span className="text-muted-foreground">{name}</span>;
        },
        sortingFn: "alphanumeric",
      },
      {
        id: "status",
        accessorFn: (row) => ({ todo: 0, in_progress: 1, done: 2 }[row.status]),
        header: ({ column }) => <SortButton column={column}>Statut</SortButton>,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <Select
                value={row.original.status}
                onValueChange={(v) => onStatusChange(row.original, v as Task["status"])}
              >
                <SelectTrigger className={`h-7 w-32 border px-2 text-xs font-medium ${getStatusClassName(row.original.status)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Termine</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <TaskStatusBadge status={row.original.status} />
            )}
          </div>
        ),
      },
      {
        id: "priority",
        accessorFn: (row) => ({ low: 0, normal: 1, high: 2 }[row.priority]),
        header: ({ column }) => <SortButton column={column}>Priorite</SortButton>,
        cell: ({ row }) => <TaskPriorityBadge priority={row.original.priority} />,
      },
      {
        id: "due_date",
        accessorKey: "due_date",
        header: ({ column }) => <SortButton column={column}>Echeance</SortButton>,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.due_date ? formatDate(row.original.due_date) : "-"}
          </span>
        ),
        sortUndefined: "last",
      },
      {
        id: "assignees",
        header: () => <span>Assignes</span>,
        cell: ({ row }) => {
          const names = row.original.assigned_to_display_names.join(", ");
          return <span className="max-w-30 truncate text-muted-foreground">{names || "-"}</span>;
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Modifier"
                    onClick={() => onEdit(row.original)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
            ) : null}
            {canDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer"
                    disabled={deletingId === row.original.id}
                    onClick={() => onDelete(row.original)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ),
        enableSorting: false,
      },
    ],
    [canEdit, canDelete, deletingId, onEdit, onDelete, onStatusChange],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Columns3 className="size-4" />
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Afficher / masquer</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {COLUMN_LABELS[col.id] ?? col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    header.id === "actions"
                      ? "w-20 text-right"
                      : header.id === "assignees"
                        ? "hidden sm:table-cell"
                        : undefined
                  }
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpenDetail(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={
                    cell.column.id === "actions"
                      ? "text-right"
                      : cell.column.id === "assignees"
                        ? "hidden sm:table-cell"
                        : undefined
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortButton({
  column,
  children,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void; getCanSort: () => boolean };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  if (!column.getCanSort()) return <span>{children}</span>;
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? (
        <ChevronUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}
