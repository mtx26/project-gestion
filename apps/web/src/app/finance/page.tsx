"use client";

import type { FinancialEntry, FinancialEntryPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
import { DocumentAttachmentField } from "@/components/ui/document-attachment-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
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
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "refund">("all");
  const [folderFilterId, setFolderFilterId] = useState<number | null>(null);

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

  const targetTreeQuery = useQuery({
    queryKey: projectId ? queryKeys.folders.targetTree(projectId) : ["folders", "target-tree", "disabled"],
    queryFn: () => api.folders.targetTree(projectId!),
    enabled: Boolean(projectId && canEditFinance),
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

  const allEntries = normalizeApiList(entriesQuery.data);
  const folders = foldersQuery.data ?? [];
  const targetFolders = targetTreeQuery.data ?? [];
  const entries = allEntries
    .filter((e) => typeFilter === "all" || e.type === typeFilter)
    .filter((e) => folderFilterId == null || e.folder === folderFilterId);
  const totals = computeTotals(entries);
  const folderFilterName = folderFilterId != null ? (findFolderName(folders, Number(folderFilterId)) ?? "Dossier") : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Finances</p>
          <h1 className="mt-1 text-2xl font-semibold">Gestion financiere</h1>
        </div>
        {canEditFinance ? (
          <Button type="button" className="gap-2" onClick={() => { setFormError(null); setCreateOpen(true); }}>
            <Plus className="size-4" />
            Nouvelle entree
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-56">
          <TreePickerDialog
            mode="folder"
            folders={folders}
            selectedFolderId={folderFilterId}
            buttonLabel={folderFilterName ?? "Tous dossiers"}
            description="Filtrer les entrees par dossier."
            onSelect={(id) => setFolderFilterId(id)}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full bg-background sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="expense">Depenses</SelectItem>
            <SelectItem value="refund">Remboursements</SelectItem>
          </SelectContent>
        </Select>
        {folderFilterId != null ? (
          <Button type="button" variant="ghost" size="sm" className="sm:w-auto" onClick={() => setFolderFilterId(null)}>
            Effacer filtre
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Depenses" value={formatMoney(totals.expenses)} className="text-destructive" />
        <SummaryCard label="Remboursements" value={formatMoney(totals.refunds)} className="text-emerald-600" />
        <SummaryCard label="Net" value={formatMoney(totals.balance)} className={totals.balance >= 0 ? "text-emerald-600" : "text-destructive"} />
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
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {entry.description ? <span className="truncate">{entry.description}</span> : null}
                  {entry.task_name ? (
                    <span className="shrink-0">{entry.task_name}</span>
                  ) : entry.folder ? (
                    <span className="shrink-0 inline-flex items-center gap-1">
                      <Folder className="size-3 text-amber-500" />
                      {findFolderName(folders, entry.folder) ?? `Dossier #${entry.folder}`}
                    </span>
                  ) : null}
                  {entry.document ? (
                    <span className="shrink-0">{entry.document_name ?? `Document #${entry.document}`}</span>
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
        projectId={projectId!}
        targetFolders={targetFolders}
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
        projectId={projectId!}
        targetFolders={targetFolders}
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
  projectId,
  targetFolders,
  error,
  isPending,
  onSubmit,
}: {
  mode: "create" | "edit";
  entry?: FinancialEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetFolders: FolderTreeNode[];
  error: string | null;
  isPending: boolean;
  onSubmit: (payload: FinancialEntryPayload) => void;
}) {
  const initialTarget = entry?.task != null
    ? `task-${entry.task}`
    : entry?.folder != null
    ? `folder-${entry.folder}`
    : "project";

  const [type, setType] = useState<"expense" | "refund">(entry?.type ?? "expense");
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [documentId, setDocumentId] = useState<number | null>(entry?.document ?? null);
  const [documentFile, setDocumentFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const targetTree = useMemo(() => buildTargetTree(targetFolders), [targetFolders]);
  const targetLabel = useMemo(() => findTargetLabel(targetTree, targetValue) ?? "Projet", [targetTree, targetValue]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setType(entry?.type ?? "expense");
      setAmount(entry?.amount ?? "");
      setCategory(entry?.category ?? "");
      setDescription(entry?.description ?? "");
      setTargetValue(initialTarget);
      setDocumentId(entry?.document ?? null);
      setDocumentFile(null);
      setUploadError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setUploadError(null);

    let resolvedDocumentId = documentId;

    if (documentFile) {
      setUploading(true);
      const { folder } = getTargetPayload(targetValue);
      try {
        const uploaded: ApiFile = await api.documents.upload(projectId, {
          file: documentFile,
          folder: folder ?? undefined,
          name: documentFile.name,
        });
        resolvedDocumentId = uploaded.id;
      } catch (err) {
        setUploadError(getErrorMessage(err));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const { folder, task } = getTargetPayload(targetValue);
    onSubmit({
      type,
      amount: amount.replace(",", "."),
      category: category.trim() || null,
      description: description.trim() || null,
      folder,
      task,
      document: resolvedDocumentId,
    });
  }

  const isSubmitting = uploading || isPending;

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
            <Label>Cible (optionnel)</Label>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={targetLabel}
              onSelect={setTargetValue}
            />
          </div>

          <DocumentAttachmentField
            documentId={documentId}
            documentName={entry?.document_name}
            selectedFile={documentFile}
            onFileChange={setDocumentFile}
            onClearDocument={() => setDocumentId(null)}
          />

          {uploadError ? (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}

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
          <Button type="submit" form="finance-form" disabled={isSubmitting}>
            {uploading ? "Upload…" : mode === "create" ? "Creer" : "Enregistrer"}
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
