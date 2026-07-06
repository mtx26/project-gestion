"use client";

import type { ExpenseRequest, File as ApiFile, FinancialEntry, Folder, Project, Task, TimeEntry } from "@project-gestion/types";
import { permissionCodes } from "@project-gestion/permissions";
import { getApiCount, normalizeApiList } from "@project-gestion/api";
import { queryKeys } from "@project-gestion/query-keys";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, FileText, Folder as FolderIcon, ListTodo, Lock, Receipt, RotateCcw, Wallet } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { formatDate, formatDuration, formatMoney } from "@/lib/task-utils";
import { useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell, type ProjectWorkspaceState } from "@/components/dashboard/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NoProjectState } from "@/components/states/no-project-state";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { FileAttachment } from "@/components/documents/file-attachment";
import { PaginationBar } from "@/components/pagination-bar";
import { SkeletonLoader } from "@/components/states/skeleton-loader";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { api } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { parsePageParam } from "@/lib/url-params";
import { useProjectPermissions } from "@/lib/use-project-permissions";
import { useUrlFilter } from "@/lib/use-url-filter";
import { useTrashResource } from "./lib/use-trash-resource";

export function TrashPageContent() {
  return (
    <ProjectWorkspaceShell>
      {(state) => <TrashView {...state} />}
    </ProjectWorkspaceShell>
  );
}

function TrashView({ user, selectedProject, openCreateProject }: ProjectWorkspaceState) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "projects";
  const page = parsePageParam(searchParams.get("page"));
  const projectId = selectedProject?.id ?? null;
  const updateUrlFilter = useUrlFilter("/trash", searchParams, projectId);

  const { can } = useProjectPermissions(selectedProject, user?.id ?? null);
  const canRestoreFiles = can(permissionCodes.fileRestore);
  const canRestoreTasks = can(permissionCodes.taskRestore);
  const canRestoreTime = can(permissionCodes.timeEntryRestore);
  const canRestoreFinance = can(permissionCodes.financeRestore);
  const canRestoreExpenseRequests = can(permissionCodes.expenseRequestRestore);

  function setTab(value: string) {
    updateUrlFilter({ tab: value });
  }

  function setPage(value: number) {
    updateUrlFilter({ page: value });
  }

  const lockedFiles = !!(selectedProject && !canRestoreFiles);
  const lockedTasks = !!(selectedProject && !canRestoreTasks);
  const lockedTime = !!(selectedProject && !canRestoreTime);
  const lockedFinance = !!(selectedProject && !canRestoreFinance);
  const lockedRequests = !!(selectedProject && !canRestoreExpenseRequests);

  const disabledByTab: Record<string, boolean> = {
    folders: lockedFiles, documents: lockedFiles, tasks: lockedTasks,
    time: lockedTime, finance: lockedFinance, requests: lockedRequests,
  };

  useEffect(() => {
    // Only depends on the locked flags and `tab`; `setTab` is intentionally
    // excluded since it closes over `searchParams`/`router` and would make this
    // effect re-run on every navigation instead of only when access changes.
    if (disabledByTab[tab]) setTab("projects");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lockedFiles, lockedTasks, lockedTime, lockedFinance, lockedRequests]);

  const projectsTrashQuery = useQuery({
    queryKey: queryKeys.projects.trash(),
    queryFn: api.projects.trash,
  });
  const restoreProject = useMutation({
    mutationFn: (id: number) => api.projects.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.trash() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
    onError: toastError,
  });

  const foldersTrash = useTrashResource<Folder>({
    queryKey: projectId ? queryKeys.folders.trash(projectId, page) : ["folders", "trash", "disabled"],
    queryFn: () => api.folders.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreFiles),
    restoreFn: (id) => api.folders.restore(projectId!, id),
    invalidateKeys: [["projects", projectId!, "folders", "trash"], queryKeys.folders.allTree(projectId!)],
  });

  const documentsTrash = useTrashResource<ApiFile>({
    queryKey: projectId ? queryKeys.documents.trash(projectId, page) : ["documents", "trash", "disabled"],
    queryFn: () => api.documents.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreFiles),
    restoreFn: (id) => api.documents.restore(projectId!, id),
    invalidateKeys: [["projects", projectId!, "documents", "trash"], queryKeys.folders.allTree(projectId!)],
  });

  const tasksTrash = useTrashResource<Task>({
    queryKey: projectId ? queryKeys.tasks.trash(projectId, page) : ["tasks", "trash", "disabled"],
    queryFn: () => api.tasks.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreTasks),
    restoreFn: (id) => api.tasks.restore(projectId!, id),
    invalidateKeys: [queryKeys.tasks.all(projectId!), queryKeys.folders.allTree(projectId!)],
  });

  const timeEntriesTrash = useTrashResource<TimeEntry>({
    queryKey: projectId ? queryKeys.timeEntries.trash(projectId, page) : ["time-entries", "trash", "disabled"],
    queryFn: () => api.timeEntries.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreTime),
    restoreFn: (id) => api.timeEntries.restore(projectId!, id),
    invalidateKeys: [queryKeys.timeEntries.all(projectId!)],
  });

  const financialEntriesTrash = useTrashResource<FinancialEntry>({
    queryKey: projectId ? queryKeys.financialEntries.trash(projectId, page) : ["financial-entries", "trash", "disabled"],
    queryFn: () => api.financialEntries.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreFinance),
    restoreFn: (id) => api.financialEntries.restore(projectId!, id),
    invalidateKeys: [queryKeys.financialEntries.all(projectId!)],
  });

  const expenseRequestsTrash = useTrashResource<ExpenseRequest>({
    queryKey: projectId ? queryKeys.expenseRequests.trash(projectId, page) : ["expense-requests", "trash", "disabled"],
    queryFn: () => api.expenseRequests.trash(projectId!, { page }),
    enabled: Boolean(projectId && canRestoreExpenseRequests),
    restoreFn: (id) => api.expenseRequests.restore(projectId!, id),
    invalidateKeys: [queryKeys.expenseRequests.all(projectId!)],
  });

  const deletedProjects = normalizeApiList(projectsTrashQuery.data);
  const deletedProjectsCount = getApiCount(projectsTrashQuery.data);

  const lockedMsg = (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Lock className="size-4" /></EmptyMedia>
        <EmptyTitle>Acces restreint</EmptyTitle>
        <EmptyDescription>Vous n&apos;avez pas acces a cet onglet.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
  const noProjectMsg = (
    <NoProjectState
      icon={RotateCcw}
      description="Cree ou selectionne un projet pour voir la corbeille."
      onCreateProject={openCreateProject}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <PageTitle category="Corbeille" title="Elements supprimes" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <ScrollableTabsList>
          <TabsTrigger value="projects" className="gap-2">
            Projets
            {deletedProjectsCount > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{deletedProjectsCount}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="folders" className="gap-2" disabled={lockedFiles}>
            {lockedFiles ? <Lock className="size-4" /> : <FolderIcon className="size-4" />}
            Dossiers
            {foldersTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{foldersTrash.count}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" disabled={lockedFiles}>
            {lockedFiles ? <Lock className="size-4" /> : <FileText className="size-4" />}
            Documents
            {documentsTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{documentsTrash.count}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" disabled={lockedTasks}>
            {lockedTasks ? <Lock className="size-4" /> : <ListTodo className="size-4" />}
            Taches
            {tasksTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{tasksTrash.count}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2" disabled={lockedTime}>
            {lockedTime ? <Lock className="size-4" /> : <Clock3 className="size-4" />}
            Temps
            {timeEntriesTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{timeEntriesTrash.count}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2" disabled={lockedFinance}>
            {lockedFinance ? <Lock className="size-4" /> : <Wallet className="size-4" />}
            Finance
            {financialEntriesTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{financialEntriesTrash.count}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2" disabled={lockedRequests}>
            {lockedRequests ? <Lock className="size-4" /> : <Receipt className="size-4" />}
            Remboursements
            {expenseRequestsTrash.count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{expenseRequestsTrash.count}</span>
            ) : null}
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="projects" className="mt-4">
          <TrashSection<Project>
            isLoading={projectsTrashQuery.isLoading}
            canRestore={true}
            items={deletedProjects}
            getName={(p) => p.name}
            getSubtitle={(p) => formatDeletedAt(p.deleted_at)}
            onRestore={(p) => restoreProject.mutate(p.id)}
            isRestoring={restoreProject.isPending}
            emptyText="Aucun projet supprime."
          />
        </TabsContent>

        <TabsContent value="folders" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFiles ? lockedMsg : (
            <>
              <TrashSection<Folder>
                isLoading={foldersTrash.isLoading}
                canRestore={canRestoreFiles}
                items={foldersTrash.items}
                getName={(f) => f.name}
                getSubtitle={(f) => formatDeletedAt(f.deleted_at)}
                onRestore={(f) => foldersTrash.restore.mutate(f.id)}
                isRestoring={foldersTrash.restore.isPending}
                emptyText="Aucun dossier supprime."
              />
              <PaginationBar count={foldersTrash.count} page={page} pageSize={foldersTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFiles ? lockedMsg : (
            <>
              <DocumentTrashSection
                projectId={selectedProject.id}
                isLoading={documentsTrash.isLoading}
                items={documentsTrash.items}
                onRestore={(d) => documentsTrash.restore.mutate(d.id)}
                isRestoring={documentsTrash.restore.isPending}
              />
              <PaginationBar count={documentsTrash.count} page={page} pageSize={documentsTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreTasks ? lockedMsg : (
            <>
              <TrashSection<Task>
                isLoading={tasksTrash.isLoading}
                canRestore={canRestoreTasks}
                items={tasksTrash.items}
                getName={(t) => t.title}
                getSubtitle={(t) => formatDeletedAt(t.deleted_at)}
                onRestore={(t) => tasksTrash.restore.mutate(t.id)}
                isRestoring={tasksTrash.restore.isPending}
                emptyText="Aucune tache supprimee."
              />
              <PaginationBar count={tasksTrash.count} page={page} pageSize={tasksTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreTime ? lockedMsg : (
            <>
              <TrashSection<TimeEntry>
                isLoading={timeEntriesTrash.isLoading}
                canRestore={canRestoreTime}
                items={timeEntriesTrash.items}
                getName={(e) => e.description || formatDuration(e.duration_minutes)}
                getSubtitle={(e) => formatDeletedAt(e.deleted_at)}
                onRestore={(e) => timeEntriesTrash.restore.mutate(e.id)}
                isRestoring={timeEntriesTrash.restore.isPending}
                emptyText="Aucune entree de temps supprimee."
              />
              <PaginationBar count={timeEntriesTrash.count} page={page} pageSize={timeEntriesTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreFinance ? lockedMsg : (
            <>
              <TrashSection<FinancialEntry>
                isLoading={financialEntriesTrash.isLoading}
                canRestore={canRestoreFinance}
                items={financialEntriesTrash.items}
                getName={(e) => e.description || e.category || formatMoney(e.amount)}
                getSubtitle={(e) => `${e.type === "expense" ? "Depense" : "Remboursement"} · ${formatMoney(e.amount)} · ${formatDeletedAt(e.deleted_at)}`}
                onRestore={(e) => financialEntriesTrash.restore.mutate(e.id)}
                isRestoring={financialEntriesTrash.restore.isPending}
                emptyText="Aucune entree financiere supprimee."
              />
              <PaginationBar count={financialEntriesTrash.count} page={page} pageSize={financialEntriesTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {!selectedProject ? noProjectMsg : !canRestoreExpenseRequests ? lockedMsg : (
            <>
              <TrashSection<ExpenseRequest>
                isLoading={expenseRequestsTrash.isLoading}
                canRestore={canRestoreExpenseRequests}
                items={expenseRequestsTrash.items}
                getName={(e) => e.title}
                getSubtitle={(e) => `${formatMoney(e.amount)} · ${formatDeletedAt(e.deleted_at)}`}
                onRestore={(e) => expenseRequestsTrash.restore.mutate(e.id)}
                isRestoring={expenseRequestsTrash.restore.isPending}
                emptyText="Aucune demande de remboursement supprimee."
              />
              <PaginationBar count={expenseRequestsTrash.count} page={page} pageSize={expenseRequestsTrash.pageSize} onPageChange={setPage} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocumentTrashSection({
  projectId,
  isLoading,
  items,
  onRestore,
  isRestoring,
}: {
  projectId: number;
  isLoading: boolean;
  items: ApiFile[];
  onRestore: (item: ApiFile) => void;
  isRestoring: boolean;
}) {
  if (isLoading) {
    return (
      <SkeletonLoader count={3} className="h-16 w-full rounded-lg" />
    );
  }

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aucun document supprime.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((doc) => (
        <FileAttachment
          key={doc.id}
          file={{ name: doc.name, file_name: doc.file_name, mime_type: doc.mime_type, file_size: doc.file_size }}
          documentId={doc.id}
          projectId={projectId}
          descriptionSuffix={formatDeletedAt(doc.deleted_at)}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestore(doc)}
              disabled={isRestoring}
            >
              <RotateCcw className="size-3.5" />
              Restaurer
            </Button>
          }
        />
      ))}
    </div>
  );
}

function TrashSection<T extends { id: number }>({
  isLoading,
  canRestore,
  items,
  getName,
  getSubtitle,
  onRestore,
  isRestoring,
  emptyText,
}: {
  isLoading: boolean;
  canRestore: boolean;
  items: T[];
  getName: (item: T) => string;
  getSubtitle: (item: T) => string;
  onRestore: (item: T) => void;
  isRestoring: boolean;
  emptyText: string;
}) {
  if (isLoading) {
    return (
      <SkeletonLoader count={3} />
    );
  }

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyText}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {items.map((item) => (
        <Item key={item.id} variant="outline">
          <ItemContent>
            <ItemTitle>{getName(item)}</ItemTitle>
            <ItemDescription>{getSubtitle(item)}</ItemDescription>
          </ItemContent>
          {canRestore ? (
            <ItemActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRestore(item)}
                disabled={isRestoring}
              >
                <RotateCcw className="size-3.5" />
                Restaurer
              </Button>
            </ItemActions>
          ) : null}
        </Item>
      ))}
    </ItemGroup>
  );
}

function formatDeletedAt(deletedAt: string | null): string {
  if (!deletedAt) return "";
  return `Supprime le ${formatDate(deletedAt)}`;
}
