"use client";

import type { FinancialEntry, FinancialEntryPayload, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderTreePickerDialog } from "@/components/ui/folder-tree-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatMoney } from "@/lib/task-utils";

function buildFinanceHref(projectId: number | string, params: URLSearchParams) {
  return `/finance?project=${projectId}`;
}

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="finance"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildFinanceHref(id, searchParams))}
      onProjectCreated={(project) => router.push(buildFinanceHref(project.id, searchParams))}
    >
      {(state) => <FinancePageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function FinancePageContent({ user, selectedProject, queryClient }: ProjectWorkspaceState) {
  const canViewFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeView);
  const canEditFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeEdit);
  const canDeleteFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeDelete);
  const projectId = selectedProject?.id ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const entriesQuery = useQuery({
    queryKey: projectId ? queryKeys.financialEntries.list(projectId) : ["financial-entries", "disabled"],
    queryFn: () => api.financialEntries.list(projectId!),
    enabled: Boolean(projectId && canViewFinance),
  });

  const foldersQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.tree(projectId) : ["folders", "tree", "disabled"],
    queryFn: () => api.folders.tree(projectId!),
    enabled: Boolean(projectId && canViewFinance),
  });

  const createEntry = useMutation({
    mutationFn: (payload: FinancialEntryPayload) => api.financialEntries.create(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.list(projectId!) });
      setCreateOpen(false);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FinancialEntryPayload> }) =>
      api.financialEntries.update(projectId!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.list(projectId!) });
      setEditingEntry(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.financialEntries.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.list(projectId!) });
      setDeletingEntryId(null);
    },
  });

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p>Selectionnez un projet pour voir les finances.</p>
      </div>
    );
  }

  if (!canViewFinance) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p>Vous n&apos;avez pas acces aux finances de ce projet.</p>
      </div>
    );
  }

  const entries = normalizeApiList(entriesQuery.data);
  const folders = foldersQuery.data ?? [];
  const totals = computeTotals(entries);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Finances</h1>
          <p className="mt-1 text-sm text-muted-foreground">Depenses et remboursements du projet.</p>
        </div>
        {canEditFinance ? (
          <Button type="button" onClick={() => { setFormError(null); setCreateOpen(true); }} className="gap-2">
            <Plus className="size-4" />
            Nouvelle entree
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Depenses" value={formatMoney(totals.expenses)} className="text-destructive" />
        <SummaryCard label="Remboursements" value={formatMoney(totals.refunds)} className="text-emerald-600" />
        <SummaryCard label="Solde" value={formatMoney(totals.balance)} className={totals.balance >= 0 ? "text-emerald-600" : "text-destructive"} />
      </div>

      {entriesQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune entree financiere.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
            >
              <EntryTypeBadge type={entry.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
                  </span>
                  {entry.category ? (
                    <span className="truncate text-sm text-muted-foreground">{entry.category}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {entry.description ? <span className="truncate">{entry.description}</span> : null}
                  {entry.folder ? (
                    <span className="shrink-0">
                      {findFolderName(folders, entry.folder) ?? `Dossier #${entry.folder}`}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0">
                    {new Date(entry.created_at).toLocaleDateString("fr-BE")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {canEditFinance ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setFormError(null); setEditingEntry(entry); }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {canDeleteFinance ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingEntryId(entry.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <FinancialEntryFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setFormError(null); }}
        folders={folders}
        error={formError}
        isPending={createEntry.isPending}
        onSubmit={(payload) => createEntry.mutate(payload)}
      />

      <FinancialEntryFormDialog
        key={editingEntry?.id ?? "edit-none"}
        mode="edit"
        entry={editingEntry ?? undefined}
        open={editingEntry != null}
        onOpenChange={(open) => { if (!open) { setEditingEntry(null); setFormError(null); } }}
        folders={folders}
        error={formError}
        isPending={updateEntry.isPending}
        onSubmit={(payload) => editingEntry && updateEntry.mutate({ id: editingEntry.id, payload })}
      />

      <Dialog open={deletingEntryId != null} onOpenChange={(open) => { if (!open) setDeletingEntryId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;entree</DialogTitle>
            <DialogDescription>Cette action est reversible depuis la corbeille.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteEntry.isPending}
              onClick={() => deletingEntryId != null && deleteEntry.mutate(deletingEntryId)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinancialEntryFormDialog({
  mode,
  entry,
  open,
  onOpenChange,
  folders,
  error,
  isPending,
  onSubmit,
}: {
  mode: "create" | "edit";
  entry?: FinancialEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderTreeNode[];
  error: string | null;
  isPending: boolean;
  onSubmit: (payload: FinancialEntryPayload) => void;
}) {
  const [type, setType] = useState<"expense" | "refund">(entry?.type ?? "expense");
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [folderId, setFolderId] = useState<number | null>(entry?.folder ?? null);
  const folderName = findFolderName(folders, folderId);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setType(entry?.type ?? "expense");
      setAmount(entry?.amount ?? "");
      setCategory(entry?.category ?? "");
      setDescription(entry?.description ?? "");
      setFolderId(entry?.folder ?? null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      type,
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
      folder: folderId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouvelle entree" : "Modifier l'entree"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Ajouter une depense ou un remboursement." : "Modifier les details de cette entree."}
          </DialogDescription>
        </DialogHeader>

        <form id="finance-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "expense" | "refund")}>
                <SelectTrigger id="entry-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Depense</SelectItem>
                  <SelectItem value="refund">Remboursement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-amount">Montant (€)</Label>
              <Input
                id="entry-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-category">Categorie</Label>
            <Input
              id="entry-category"
              type="text"
              placeholder="Ex: Transport, Materiel…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-description">Description</Label>
            <Textarea
              id="entry-description"
              rows={2}
              placeholder="Details optionnels…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Dossier (optionnel)</Label>
            <FolderTreePickerDialog
              folders={folders}
              selectedFolderId={folderId}
              buttonLabel={folderName ?? "Aucun dossier"}
              onSelect={setFolderId}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Annuler</Button>
          </DialogClose>
          <Button type="submit" form="finance-form" disabled={isPending}>
            {mode === "create" ? "Creer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className={`text-2xl font-bold tabular-nums ${className ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EntryTypeBadge({ type }: { type: "expense" | "refund" }) {
  if (type === "expense") {
    return (
      <Badge variant="outline" className="shrink-0 border-red-200 bg-red-50 text-red-700">
        Depense
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
      Remboursement
    </Badge>
  );
}

function computeTotals(entries: FinancialEntry[]) {
  let expenses = 0;
  let refunds = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    if (e.type === "expense") expenses += amount;
    else refunds += amount;
  }
  return { expenses, refunds, balance: refunds - expenses };
}
