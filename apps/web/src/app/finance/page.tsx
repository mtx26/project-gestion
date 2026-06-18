"use client";

import type { FinancialEntry, FinancialEntryPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, FileText, Folder, ListTodo, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EntryDetailBody } from "@/components/ui/entry-detail-body";
import { PageTitle } from "@/components/ui/page-title";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { MultiDocumentAttachmentField } from "@/components/ui/multi-document-attachment-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatMoney } from "@/lib/task-utils";
import { parseIdParam, setOptionalParam } from "@/lib/url-params";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const canViewFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeView);
  const canEditFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeEdit);
  const canDeleteFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeDelete);
  const projectId = selectedProject?.id ?? null;

  const typeFilter = parseTypeFilter(searchParams.get("type"));
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const userFilterId = parseIdParam(searchParams.get("member"));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [viewingEntry, setViewingEntry] = useState<FinancialEntry | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function updateUrlFilter(changes: { type?: string; folder?: number | null; member?: number | null }) {
    if (!selectedProject) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", String(selectedProject.id));
    if ("type" in changes) setOptionalParam(params, "type", changes.type ?? "all");
    if ("folder" in changes) {
      if (changes.folder != null) params.set("folder", String(changes.folder));
      else params.delete("folder");
    }
    if ("member" in changes) {
      if (changes.member != null) params.set("member", String(changes.member));
      else params.delete("member");
    }
    router.replace(`/finance?${params.toString()}`, { scroll: false });
  }

  const entriesQuery = useQuery({
    queryKey: projectId
      ? queryKeys.financialEntries.list(projectId, {
          type: typeFilter !== "all" ? typeFilter : undefined,
          folder: folderFilterId ?? undefined,
          createdBy: userFilterId ?? undefined,
        })
      : ["financial-entries", "disabled"],
    queryFn: () => api.financialEntries.list(projectId!, {
      type: typeFilter !== "all" ? typeFilter : undefined,
      folder: folderFilterId ?? undefined,
      created_by: userFilterId ?? undefined,
    }),
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

  const membersQuery = useQuery({
    queryKey: projectId ? queryKeys.members.list(projectId) : ["members", "disabled"],
    queryFn: () => api.members.list(projectId!),
    enabled: Boolean(projectId && canViewFinance),
  });

  const createEntry = useMutation({
    mutationFn: (payload: FinancialEntryPayload) => api.financialEntries.create(projectId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
      setCreateOpen(false);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FinancialEntryPayload> }) =>
      api.financialEntries.update(projectId!, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
      setEditingEntry(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.financialEntries.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
      setDeletingEntryId(null);
    },
  });

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: (err) => setFormError(getErrorMessage(err)),
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
  const members = normalizeApiList(membersQuery.data);
  const search = searchQuery.trim().toLowerCase();
  const entries = search
    ? allEntries.filter((e) =>
        (e.category ?? "").toLowerCase().includes(search) ||
        (e.description ?? "").toLowerCase().includes(search) ||
        (e.task_name ?? "").toLowerCase().includes(search) ||
        (e.created_by_name ?? "").toLowerCase().includes(search),
      )
    : allEntries;
  const totals = computeTotals(entries);
  const folderFilterName = folderFilterId != null ? (findFolderName(folders, folderFilterId) ?? "Dossier") : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle category="Finances" title="Gestion financiere" />
        {canEditFinance ? (
          <Button type="button" className="gap-2" onClick={() => { setFormError(null); setCreateOpen(true); }}>
            <Plus className="size-4" />
            Nouvelle entree
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-nowrap sm:items-center">
        <Select value={typeFilter} onValueChange={(v) => updateUrlFilter({ type: v })}>
          <SelectTrigger className="w-full bg-background sm:flex-1 sm:min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="expense">Depenses</SelectItem>
            <SelectItem value="refund">Remboursements</SelectItem>
          </SelectContent>
        </Select>
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        <div className="w-full sm:flex-1 sm:min-w-0">
          <TreePickerDialog
            mode="folder"
            folders={folders}
            selectedFolderId={folderFilterId}
            buttonLabel={folderFilterName ?? "Tous dossiers"}
            description="Filtrer les entrees par dossier."
            onSelect={(id) => updateUrlFilter({ folder: id })}
          />
        </div>
        <Input
          className="w-full bg-background sm:flex-1 sm:min-w-0"
          placeholder="Rechercher…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setSearchQuery("");
            const params = new URLSearchParams({ project: String(selectedProject.id) });
            router.replace(`/finance?${params.toString()}`, { scroll: false });
          }}
        >
          Effacer filtres
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Depenses" value={formatMoney(totals.expenses)} className="text-destructive" />
        <SummaryCard label="Remboursements" value={formatMoney(totals.refunds)} className="text-emerald-600" />
        <SummaryCard label="Net" value={formatMoney(totals.balance)} className={totals.balance >= 0 ? "text-emerald-600" : "text-destructive"} />
      </div>

      {entriesQuery.isLoading ? (
        <SkeletonLoader count={5} />
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune entree financiere.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex cursor-pointer items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30"
              onClick={() => setViewingEntry(entry)}
            >
              <EntryTypeBadge type={entry.type} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold tabular-nums">
                    {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
                  </span>
                  {entry.category ? (
                    <span className="truncate text-sm text-muted-foreground">{entry.category}</span>
                  ) : null}
                </div>
                {entry.description ? (
                  <p className="truncate text-sm text-muted-foreground">{entry.description}</p>
                ) : null}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {entry.task_name ? (
                    <span className="inline-flex items-center gap-1">
                      <ListTodo className="size-3 text-sky-600" />
                      {entry.task_name}
                    </span>
                  ) : entry.folder ? (
                    <span className="inline-flex items-center gap-1">
                      <Folder className="size-3 text-amber-500" />
                      {findFolderName(folders, entry.folder) ?? `Dossier #${entry.folder}`}
                    </span>
                  ) : null}
                  {(entry.documents_info ?? []).length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3" />
                      {entry.documents_info[0].name ?? `Document #${entry.documents_info[0].id}`}
                      {entry.documents_info.length > 1 ? ` +${entry.documents_info.length - 1}` : ""}
                    </span>
                  ) : null}
                  {entry.time_entry_user_name ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3 text-violet-500" />
                      Pour {entry.time_entry_user_name}
                    </span>
                  ) : entry.created_by_name ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" />
                      {entry.created_by_name}
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Calendar className="size-3" />
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
                    onClick={(e) => { e.stopPropagation(); setFormError(null); setEditingEntry(entry); }}
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
                    onClick={(e) => { e.stopPropagation(); setDeletingEntryId(entry.id); }}
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

      <ConfirmDeleteDialog
        open={deletingEntryId != null}
        title="Supprimer l'entree"
        isPending={deleteEntry.isPending}
        onConfirm={() => deletingEntryId != null && deleteEntry.mutate(deletingEntryId)}
        onClose={() => setDeletingEntryId(null)}
      />

      <FinancialEntryDetailDialog
        entry={viewingEntry}
        folders={folders}
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingEntry(null)}
      />

      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
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

  function buildInitialDocs() {
    return (entry?.documents_info ?? []).map((d) => ({ id: d.id, name: d.name }));
  }

  const [type, setType] = useState<"expense" | "refund">(entry?.type ?? "expense");
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [existingDocs, setExistingDocs] = useState<Array<{ id: number; name: string | null }>>(buildInitialDocs);
  const [pendingFiles, setPendingFiles] = useState<globalThis.File[]>([]);
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
      setExistingDocs(buildInitialDocs());
      setPendingFiles([]);
      setUploadError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.BaseSyntheticEvent) {
    e.preventDefault();
    setUploadError(null);

    const newDocIds: number[] = [];

    if (pendingFiles.length > 0) {
      setUploading(true);
      const { folder } = getTargetPayload(targetValue);
      try {
        for (const file of pendingFiles) {
          const uploaded: ApiFile = await api.documents.upload(projectId, {
            file,
            folder: folder ?? undefined,
            name: file.name,
          });
          newDocIds.push(uploaded.id);
        }
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
      documents: [...existingDocs.map((d) => d.id), ...newDocIds],
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

          <MultiDocumentAttachmentField
            existingDocs={existingDocs}
            pendingFiles={pendingFiles}
            onRemoveDoc={(id) => setExistingDocs((prev) => prev.filter((d) => d.id !== id))}
            onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
            onRemoveFile={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
          />

          <FormErrorAlert error={uploadError} />
          <FormErrorAlert error={error} />
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

function FinancialEntryDetailDialog({
  entry,
  folders,
  isOpeningDocument,
  onOpenDocument,
  onClose,
}: {
  entry: FinancialEntry | null;
  folders: FolderTreeNode[];
  isOpeningDocument: boolean;
  onOpenDocument: (documentId: number) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail de l&apos;entree</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <EntryTypeBadge type={entry.type} />
              <span className="text-2xl font-semibold tabular-nums">
                {entry.type === "expense" ? "-" : "+"}{formatMoney(entry.amount)}
              </span>
            </div>

            <EntryDetailBody
              category={entry.category}
              description={entry.description}
              task_name={entry.task_name}
              folder={entry.folder}
              documents_info={entry.documents_info}
              folders={folders}
              isOpeningDocument={isOpeningDocument}
              onOpenDocument={onOpenDocument}
            />

            <div className="grid grid-cols-2 gap-3 text-sm">
              {entry.time_entry_user_name ? (
                <div>
                  <p className="text-xs text-muted-foreground">Pour</p>
                  <div className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 text-violet-500" />
                    <span>{entry.time_entry_user_name}</span>
                  </div>
                </div>
              ) : entry.created_by_name ? (
                <div>
                  <p className="text-xs text-muted-foreground">Cree par</p>
                  <div className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 text-muted-foreground" />
                    <span>{entry.created_by_name}</span>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>{new Date(entry.created_at).toLocaleDateString("fr-BE")}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fermer</Button>
          </DialogClose>
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

function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  if (value === "expense" || value === "refund") return value;
  return "all";
}

