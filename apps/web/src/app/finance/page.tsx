"use client";

import type { FinancialEntry, FinancialEntryPayload } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { AccessDeniedState } from "@/components/ui/access-denied-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { DocumentPreviewModal, type PreviewDocument } from "@/components/ui/document-preview-modal";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EntryMetadataRow } from "@/components/ui/entry-metadata-row";
import { EntryTypeBadge } from "@/components/ui/entry-type-badge";
import { FilterBar, FilterClear, FilterFolderPicker, FilterSearch, FilterSelect } from "@/components/ui/filter-bar";
import { MemberFilterSelect } from "@/components/ui/member-filter-select";
import { NoProjectState } from "@/components/ui/no-project-state";
import { PageTitle } from "@/components/ui/page-title";
import { SelectItem } from "@/components/ui/select";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFolderNameMap } from "@/lib/folder-utils";
import { formatMoney } from "@/lib/task-utils";
import { buildFilterParams, parseIdParam } from "@/lib/url-params";
import { FinanceBarChart } from "./components/finance-bar-chart";
import { FinancialEntryDetailDialog, FinancialEntryFormDialog } from "./components/finance-entry-dialogs";
import { buildFinanceHref, computeTotals, parseTypeFilter } from "./lib/finance-utils";

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

  function updateUrlFilter(changes: Record<string, string | number | boolean | null | undefined>) {
    if (!selectedProject) return;
    const params = buildFilterParams(searchParams, selectedProject.id, changes);
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
    queryFn: () =>
      api.financialEntries.list(projectId!, {
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
    return <AccessDeniedState description="Vous n'avez pas acces aux finances de ce projet." />;
  }

  const allEntries = normalizeApiList(entriesQuery.data);
  const folders = foldersQuery.data ?? [];
  const targetFolders = targetTreeQuery.data ?? [];
  const members = normalizeApiList(membersQuery.data);
  const folderNameById = useMemo(() => buildFolderNameMap(folders), [folders]);
  const search = searchQuery.trim().toLowerCase();
  const entries = search
    ? allEntries.filter(
        (e) =>
          (e.category ?? "").toLowerCase().includes(search) ||
          (e.description ?? "").toLowerCase().includes(search) ||
          (e.task_name ?? "").toLowerCase().includes(search) ||
          (e.created_by_name ?? "").toLowerCase().includes(search),
      )
    : allEntries;
  const totals = computeTotals(entries);
  const folderFilterName = folderFilterId != null ? (folderNameById.get(folderFilterId) ?? "Dossier") : null;

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
        <SummaryCard
          label="Net"
          value={formatMoney(totals.balance)}
          className={totals.balance >= 0 ? "text-emerald-600" : "text-destructive"}
        />
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
                <EntryMetadataRow
                  taskName={entry.task_name}
                  folderId={entry.folder}
                  folderName={entry.folder ? (folderNameById.get(entry.folder) ?? `Dossier #${entry.folder}`) : null}
                  documents={entry.documents_info}
                  userName={entry.time_entry_user_name ?? entry.created_by_name}
                  userIconClassName={entry.time_entry_user_name ? "text-violet-500" : undefined}
                  userPrefix={entry.time_entry_user_name ? "Pour " : undefined}
                  date={entry.created_at}
                  showDateIcon
                />
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
