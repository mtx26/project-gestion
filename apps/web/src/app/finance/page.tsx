"use client";

import type { FinancialEntry, FinancialEntryPayload, File as ApiFile, FolderTreeNode } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, Calendar, FileText, Folder, ListTodo, Lock, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { EntryTypeBadge } from "@/components/ui/entry-type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EntryDetailBody } from "@/components/ui/entry-detail-body";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NoProjectState } from "@/components/ui/no-project-state";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSearch, FilterSelect } from "@/components/ui/filter-bar";
import { MultiDocumentAttachmentField } from "@/components/ui/multi-document-attachment-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { Textarea } from "@/components/ui/textarea";
import { TreePickerDialog, buildTargetTree, findTargetLabel, getTargetPayload } from "@/components/ui/tree-picker";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { findFolderName } from "@/lib/folder-utils";
import { formatDate, formatMoney } from "@/lib/task-utils";
import { parseIdParam, setOptionalParam } from "@/lib/url-params";

function buildFinanceHref(projectId: number | string) {
  return `/finance?project=${projectId}`;
}

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="finance"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildFinanceHref(id))}
      onProjectCreated={(project) => router.push(buildFinanceHref(project.id))}
    >
      {(state) => <FinancePageContent {...state} />}
    </ProjectWorkspaceShell>
  );
}

function FinancePageContent({ user, selectedProject, queryClient, openCreateProject }: ProjectWorkspaceState) {
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
      toast.success("Entree creee");
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
      toast.success("Entree mise a jour");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
      setEditingEntry(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.financialEntries.remove(projectId!, id),
    onSuccess: () => {
      toast.success("Entree supprimee");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "financial-entries"] });
      setDeletingEntryId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openDocument = useMutation({
    mutationFn: (documentId: number) => api.documents.download(projectId!, documentId),
    onSuccess: (data) => setPreviewDocument(data),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      api.folders.create(projectId!, { name, parent_folder: parentId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.tree(projectId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders.targetTree(projectId!) }),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function handleCreateFolder(name: string, parentId: number | null) {
    await createFolder.mutateAsync({ name, parentId });
  }

  if (!selectedProject) {
    return (
      <NoProjectState
        icon={Banknote}
        description="Cree ou selectionne un projet pour voir les finances."
        onCreateProject={openCreateProject}
      />
    );
  }

  if (!canViewFinance) {
    return (
      <Empty className="border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Lock className="size-4" /></EmptyMedia>
          <EmptyTitle>Acces restreint</EmptyTitle>
          <EmptyDescription>Vous n&apos;avez pas acces aux finances de ce projet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
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

      <FilterBar>
        <FilterSelect value={typeFilter} onValueChange={(v) => updateUrlFilter({ type: v })}>
          <SelectItem value="all">Tous types</SelectItem>
          <SelectItem value="expense">Dépenses</SelectItem>
          <SelectItem value="refund">Remboursements</SelectItem>
        </FilterSelect>
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          className="sm:flex-1 sm:min-w-0"
          onChange={(id) => updateUrlFilter({ member: id })}
        />
        <FilterFolderPicker
          folders={folders}
          selectedFolderId={folderFilterId}
          buttonLabel={folderFilterName ?? "Tous dossiers"}
          description="Filtrer les entrées par dossier."
          onSelect={(id) => updateUrlFilter({ folder: id })}
          onCreateFolder={canEditFinance ? handleCreateFolder : undefined}
        />
        <FilterSearch value={searchQuery} onChange={setSearchQuery} />
        <FilterClear path="/finance" removeKeys={["type", "folder", "member"]} onClick={() => setSearchQuery("")} />
      </FilterBar>

      <FinanceBarChart entries={entries} isLoading={entriesQuery.isLoading} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Depenses" value={formatMoney(totals.expenses)} className="text-destructive" />
        <SummaryCard label="Remboursements" value={formatMoney(totals.refunds)} className="text-emerald-600" />
        <SummaryCard label="Net" value={formatMoney(totals.balance)} className={totals.balance >= 0 ? "text-emerald-600" : "text-destructive"} />
      </div>

      {entriesQuery.isLoading ? (
        <SkeletonLoader count={5} />
      ) : entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Aucune entree financiere</EmptyTitle>
            <EmptyDescription>Aucune entree ne correspond aux filtres selectionnes.</EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                    {formatDate(entry.created_at)}
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
        onCreateFolder={canEditFinance ? handleCreateFolder : undefined}
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
        onCreateFolder={canEditFinance ? handleCreateFolder : undefined}
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
  onCreateFolder,
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
  onCreateFolder?: (name: string, parentId: number | null) => Promise<void>;
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
  const [date, setDate] = useState(entry?.date ?? new Date().toISOString().split("T")[0]);
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
      setDate(entry?.date ?? new Date().toISOString().split("T")[0]);
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
      date: date || null,
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
            <Field>
              <FieldLabel htmlFor="entry-type">Type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as "expense" | "refund")}>
                <SelectTrigger id="entry-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Depense</SelectItem>
                  <SelectItem value="refund">Remboursement</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="entry-amount">Montant (€)</FieldLabel>
              <Input
                id="entry-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Date</FieldLabel>
            <DatePicker value={date} onChange={setDate} />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-category">Categorie</FieldLabel>
            <Input
              id="entry-category"
              type="text"
              placeholder="Ex: Transport, Materiel…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-description">Description</FieldLabel>
            <Textarea
              id="entry-description"
              rows={2}
              placeholder="Details optionnels…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Cible (optionnel)</FieldLabel>
            <TreePickerDialog
              mode="target"
              folders={targetFolders}
              selectedValue={targetValue}
              selectedLabel={targetLabel}
              onSelect={setTargetValue}
              onCreateFolder={onCreateFolder}
            />
          </Field>

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
                  <span>{formatDate(entry.created_at)}</span>
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

const financeChartConfig = {
  expenses: { label: "Depenses", color: "var(--destructive)" },
  refunds: { label: "Remboursements", color: "oklch(0.6 0.15 150)" },
};

function FinanceBarChart({
  entries,
  isLoading,
}: {
  entries: FinancialEntry[];
  isLoading: boolean;
}) {
  const data = useMemo(() => computeFinanceChartData(entries), [entries]);

  if (isLoading) return <Skeleton className="h-52 w-full rounded-lg" />;
  if (data.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <ChartContainer config={financeChartConfig} className="h-44 w-full">
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatFinancePeriod}
          />
          <ChartTooltip content={<FinanceChartTooltip />} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} maxBarSize={32} />
          <Bar dataKey="refunds" fill="var(--color-refunds)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-destructive" />
          Depenses
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "oklch(0.6 0.15 150)" }} />
          Remboursements
        </span>
      </div>
    </div>
  );
}

function FinanceChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border/50 bg-background grid min-w-[9rem] gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{formatFinancePeriod(label ?? "")}</p>
      <div className="grid gap-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <div className="flex flex-1 items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {item.name === "expenses" ? "Depenses" : "Remboursements"}
              </span>
              <span className="font-mono font-medium tabular-nums">{formatMoney(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeFinanceChartData(entries: FinancialEntry[]) {
  const byMonth: Record<string, { period: string; expenses: number; refunds: number }> = {};
  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[period]) byMonth[period] = { period, expenses: 0, refunds: 0 };
    const amount = Number(entry.amount);
    if (entry.type === "expense") byMonth[period].expenses += amount;
    else byMonth[period].refunds += amount;
  }
  return Object.values(byMonth).sort((a, b) => a.period.localeCompare(b.period));
}

function formatFinancePeriod(period: string) {
  const [year, month] = period.split("-");
  if (year && month) {
    const names = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
    return `${names[Number(month) - 1]} ${year.slice(2)}`;
  }
  return period;
}

function parseTypeFilter(value: string | null): "all" | "expense" | "refund" {
  if (value === "expense" || value === "refund") return value;
  return "all";
}

