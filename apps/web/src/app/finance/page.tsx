"use client";

import type { FinancialEntry, FinancialEntryPayload, TimeEntry } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { getApiCount, getApiPageSize, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { AccessDeniedState } from "@/components/states/access-denied-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/dialogs/confirm-delete-dialog";
import { DocumentPreviewModal } from "@/components/dialogs/document-preview-modal";
import { useDocumentPreview } from "@/lib/use-document-preview";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EntryMetadataRow } from "@/components/entries/entry-metadata-row";
import { EntryTypeBadge } from "@/components/badges/entry-type-badge";
import { CollapsibleFilterBar } from "@/components/filters/collapsible-filter-bar";
import { FilterFolderPicker, FilterSearch, FilterSelect } from "@/components/filters/filter-bar";
import { MemberFilterSelect } from "@/components/filters/member-filter-select";
import { SelectItem } from "@/components/ui/select";
import { NoProjectState } from "@/components/states/no-project-state";
import { PageTitle } from "@/components/page-title";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { toast } from "sonner";
import { TimeEntryDetailDialog } from "@/app/time/components/time-dialogs";
import { api } from "@/lib/api";
import { getErrorMessage, toastError } from "@/lib/errors";
import { formatMoney } from "@/lib/task-utils";
import { buildProjectHref, parseEnumParam, parseIdParam, parsePageParam } from "@/lib/url-params";
import { PaginationBar } from "@/components/pagination-bar";
import { useProjectResources } from "@/lib/use-project-resources";
import { useSearchParam } from "@/lib/use-search-param";
import { useUrlFilter } from "@/lib/use-url-filter";
import { FinanceBarChart } from "./components/finance-bar-chart";
import { FinancialEntryDetailDialog, FinancialEntryFormDialog } from "./components/finance-entry-dialogs";
import { parseTypeFilter } from "./lib/finance-utils";

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ProjectWorkspaceShell
      activeItem="finance"
      selectedProjectIdFromUrl={searchParams.get("project") ?? ""}
      onProjectSelected={(id) => router.push(buildProjectHref("/finance", id, searchParams))}
      onProjectCreated={(project) => router.push(buildProjectHref("/finance", project.id, searchParams))}
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

function FinancePageContent({ user, selectedProject, openCreateProject }: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const canViewFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeView);
  const canEditFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeEdit);
  const canDeleteFinance = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.financeDelete);
  const canViewTime = hasProjectPermission(selectedProject, user?.id ?? null, permissionCodes.timeEntryView);
  const projectId = selectedProject?.id ?? null;
  const searchFromUrl = searchParams.get("search") ?? "";
  const typeFilter = parseTypeFilter(searchParams.get("type"));
  const userFilterId = parseIdParam(searchParams.get("member"));
  const folderFilterId = parseIdParam(searchParams.get("folder"));
  const ordering = parseEnumParam(searchParams.get("ordering"), ["created_at", "-amount", "amount"] as const, "all");
  const page = parsePageParam(searchParams.get("page"));

  const [createOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [viewingEntry, setViewingEntry] = useState<FinancialEntry | null>(null);
  const [viewingTimeEntry, setViewingTimeEntry] = useState<TimeEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const updateUrlFilter = useUrlFilter("/finance", searchParams, projectId);
  const [searchQuery, handleSearchChange] = useSearchParam(searchFromUrl, updateUrlFilter);
  const { folders, targetFolders, members, folderNameById, handleCreateFolder } =
    useProjectResources(projectId, { canView: canViewFinance, canEdit: canEditFinance, canFetchMembers: canViewFinance });
  const { openDocument, previewDocument, setPreviewDocument } = useDocumentPreview(projectId);

  const chartStartDate = new Date();
  chartStartDate.setFullYear(chartStartDate.getFullYear() - 1);
  const chartStartDateStr = chartStartDate.toISOString().slice(0, 10);

  const chartQuery = useQuery({
    queryKey: projectId ? queryKeys.financialEntries.chart(projectId, "month", chartStartDateStr) : ["finance-chart", "disabled"],
    queryFn: () => api.financialEntries.chart(projectId!, { group_by: "month", start_date: chartStartDateStr }),
    enabled: Boolean(projectId && canViewFinance),
  });

  const entriesQuery = useQuery({
    queryKey: projectId
      ? queryKeys.financialEntries.list(projectId, {
          search: searchFromUrl || undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          createdBy: userFilterId ?? undefined,
          folder: folderFilterId ?? undefined,
          ordering: ordering !== "all" ? ordering : undefined,
          page,
        })
      : ["financial-entries", "disabled"],
    queryFn: () =>
      api.financialEntries.list(projectId!, {
        search: searchFromUrl || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        created_by: userFilterId ?? undefined,
        folder: folderFilterId ?? undefined,
        ordering: ordering !== "all" ? ordering : undefined,
        page,
      }),
    enabled: Boolean(projectId && canViewFinance),
    placeholderData: keepPreviousData,
  });

  const createEntry = useMutation({
    mutationFn: (payload: FinancialEntryPayload) => api.financialEntries.create(projectId!, payload),
    onSuccess: () => {
      toast.success("Entree creee");
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
      setEditingEntry(null);
      setFormError(null);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: number) => api.financialEntries.remove(projectId!, id),
    onSuccess: () => {
      toast.success("Entree supprimee");
      queryClient.invalidateQueries({ queryKey: queryKeys.financialEntries.all(projectId!) });
      setDeletingEntryId(null);
      setViewingEntry(null);
    },
    onError: toastError,
  });

  async function handleTimeEntryClick(timeEntryId: number) {
    if (!projectId) return;
    setViewingEntry(null);
    try {
      const entry = await api.timeEntries.get(projectId, timeEntryId);
      setViewingTimeEntry(entry);
    } catch {
      toast.error("Impossible de charger l'entree de temps");
    }
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

  const entries = normalizeApiList(entriesQuery.data);
  const totalCount = getApiCount(entriesQuery.data);
  const chartTotals = chartQuery.data?.totals;
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

      <CollapsibleFilterBar
        primary={<FilterSearch value={searchQuery} onChange={handleSearchChange} />}
        activeCount={[typeFilter !== "all", userFilterId !== null, folderFilterId !== null, ordering !== "all"].filter(Boolean).length}
        clearPath="/finance"
        clearKeys={["search", "type", "member", "folder", "ordering", "page"]}
      >
        <FilterSelect value={typeFilter} onValueChange={(v) => updateUrlFilter({ type: v })}>
          <SelectItem value="all">Tous types</SelectItem>
          <SelectItem value="expense">Dépenses</SelectItem>
          <SelectItem value="refund">Remboursements</SelectItem>
        </FilterSelect>
        <MemberFilterSelect
          members={members}
          value={userFilterId}
          currentUserId={user?.id ?? null}
          selfLabel="Mes entrées"
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
        <FilterSelect value={ordering} onValueChange={(v) => updateUrlFilter({ ordering: v })}>
          <SelectItem value="all">Date récente</SelectItem>
          <SelectItem value="created_at">Date ancienne</SelectItem>
          <SelectItem value="-amount">Montant ↓</SelectItem>
          <SelectItem value="amount">Montant ↑</SelectItem>
        </FilterSelect>
      </CollapsibleFilterBar>

      <FinanceBarChart series={chartQuery.data?.series} isLoading={chartQuery.isLoading} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Depenses" value={formatMoney(Number(chartTotals?.expenses ?? 0))} className="text-destructive" />
        <SummaryCard label="Remboursements" value={formatMoney(Number(chartTotals?.refunds ?? 0))} className="text-emerald-600" />
        <SummaryCard
          label="Net"
          value={formatMoney(Number(chartTotals?.balance ?? 0))}
          className={Number(chartTotals?.balance ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}
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
        <>
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
                  taskId={entry.task}
                  taskName={entry.task_name}
                  folderId={entry.folder}
                  folderName={entry.folder_name ?? (entry.folder ? `Dossier #${entry.folder}` : null)}
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
          <PaginationBar count={totalCount} page={page} pageSize={getApiPageSize(entriesQuery.data)} onPageChange={(p) => updateUrlFilter({ page: p })} />
        </>
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
        isOpeningDocument={openDocument.isPending}
        onOpenDocument={(id) => openDocument.mutate(id)}
        onClose={() => setViewingEntry(null)}
        onTimeEntryClick={canViewTime ? handleTimeEntryClick : undefined}
      />
      <TimeEntryDetailDialog
        entry={viewingTimeEntry}
        onClose={() => setViewingTimeEntry(null)}
      />
      <DocumentPreviewModal
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}
